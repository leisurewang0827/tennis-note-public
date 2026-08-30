// 운동노트와 수업 기록 화면을 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderMediaPreview(mediaItems = [], compact = false) {
  if (!mediaItems.length) return "";
  return `
    <div class="journal-media-grid ${compact ? "compact" : ""}">
      ${mediaItems
        .map((item) => {
          const isVideo = item.type?.startsWith("video") || /\.(mp4|mov|webm|m4v)$/i.test(item.name || "");
          const isImage = item.type?.startsWith("image") || /\.(jpg|jpeg|png|gif|webp)$/i.test(item.name || "");
          if (item.url && isVideo) {
            return `
              <figure class="journal-media-item video">
                <video src="${item.url}" controls playsinline preload="metadata"></video>
                <figcaption>${item.name}</figcaption>
              </figure>`;
          }
          if (item.url && isImage) {
            return `
              <figure class="journal-media-item image">
                <img src="${item.url}" alt="${item.name}" loading="lazy" />
                <figcaption>${item.name}</figcaption>
              </figure>`;
          }
          return `<b class="media-chip">${item.name}</b>`;
        })
        .join("")}
    </div>`;
}

function renderJournalMode() {
  const modeSelect = $("#journalMode");
  const lessonOption = modeSelect?.querySelector('option[value="lesson"]');
  const hasLesson = memberLessons().length > 0;
  if (lessonOption) lessonOption.disabled = !hasLesson;
  if (!hasLesson && modeSelect?.value === "lesson") modeSelect.value = "practice";
  const mode = modeSelect?.value || "practice";
  const isLesson = mode === "lesson";
  if ($("#journalDate") && !$("#journalDate").value) $("#journalDate").value = localDateKey();
  $("#lessonJournalFields").hidden = !isLesson;
  $("#practiceJournalFields").hidden = isLesson;
  $("#saveJournal").textContent = isLesson ? "레슨 운동일지 저장" : "개인 운동일지 저장";
}

function renderLessonLogs() {
  syncConfirmationsFromCoach();
  syncPracticeFeedbackFromCoach();
  const pendingCount = state.lessonLogs.filter((log) => ["coach_pending", "uploading", "server_error"].includes(log.status)).length;
  const confirmedCount = state.lessonLogs.filter((log) => log.status === "confirmed").length;
  const latestLog = state.lessonLogs[0];
  if ($("#pendingNoteCount")) {
    $("#pendingNoteCount").textContent = pendingCount ? `대기 ${pendingCount}건` : confirmedCount ? `${confirmedCount}건` : "없음";
  }
  if ($("#lessonRecordNote")) {
    const latestDate = latestLog?.journalDate || (latestLog?.submittedAt ? latestLog.submittedAt.slice(0, 10) : "");
    $("#lessonRecordNote").textContent = latestLog ? latestDate : "";
  }
  const lessonItems = [...state.lessonLogs].sort((left, right) => {
    const leftKey = `${left.journalDate || ""} ${left.submittedAt || ""}`;
    const rightKey = `${right.journalDate || ""} ${right.submittedAt || ""}`;
    return rightKey.localeCompare(leftKey);
  });
  const lessonPage = normalizePage("lesson", lessonItems.length);
  const visibleLessonItems = paginateItems(lessonItems, lessonPage);
  $("#lessonLogs").innerHTML =
    visibleLessonItems
      .map(
        (log) => {
          const statusLabel = log.status === "confirmed"
            ? "피드백 완료"
            : log.status === "uploading"
              ? memberStatusLabel("coachRecord", "sync_pending", "동기화 대기")
              : log.status === "server_error"
                ? memberStatusLabel("coachRecord", "sync_failed", "동기화 실패")
                : memberStatusLabel("coachRecord", "writing", "작성 전");
          const dateLabel = log.journalDate || new Date(log.submittedAt || Date.now()).toISOString().slice(0, 10);
          const outcomeLabel = {
            completed: "수업 완료",
            no_show: "노쇼",
            absence: "불참",
            cancelled: "취소",
            holiday: "휴무",
          }[String(log.participantOutcome || "").toLowerCase()] || "수업";
          const deductionLabel = Number(log.deductedSessions) > 0 || log.ticketDeducted
            ? `${Math.max(1, Number(log.deductedSessions) || 1)}회 차감`
            : "차감 없음";
          return `
            <button class="history-card compact-log summary-log ${log.status === "confirmed" ? "done" : "wait"}" type="button" data-open-journal-detail="${log.id}">
              <span class="summary-log-main">
                <strong>${lessonReviewTitle(log)}</strong>
                <small>${dateLabel} · ${log.lessonLabel} · ${outcomeLabel} · ${deductionLabel}</small>
              </span>
              <span class="summary-log-status">${statusLabel}${log.feedbackRevised ? " · 수정됨" : ""}</span>
            </button>`;
        },
      )
      .join("") || memberEmptyState({
        title: "수업 피드백이 없습니다",
        reason: "수업이 완료되면 코치의 코멘트와 다음 커리큘럼이 여기에 표시됩니다.",
        action: { label: "다음 수업 확인", homeAction: "makeup", primary: false },
        compact: true,
      });
  renderListPager("lessonLogsPager", "lesson", lessonPage, lessonItems.length);
}

function renderPracticeLogs() {
  syncPracticeFeedbackFromCoach();
  if (!$("#practiceLogs")) return;
  const practiceItems = state.practiceLogs;
  const practicePage = normalizePage("practice", practiceItems.length);
  const visiblePracticeItems = paginateItems(practiceItems, practicePage);
  $("#practiceLogs").innerHTML =
    visiblePracticeItems
      .map((log) => {
        const mediaCount = normalizeMediaItems(log).length;
        const dateLabel = log.journalDate || log.date;
        const statusLabel = log.coachFeedback ? "코치 코멘트 있음" : log.feedbackStatus || "개인 기록";
        return `
          <button class="history-card compact-log summary-log done" type="button" data-open-journal-detail="${log.id}">
            <span class="summary-log-main">
              <strong>${log.type}</strong>
              <small>${dateLabel} · ${statusLabel}${mediaCount ? ` · 첨부 ${mediaCount}개` : ""}</small>
            </span>
            <span class="summary-log-status">상세 보기</span>
          </button>`;
      })
      .join("") || memberEmptyState({
        title: "개인 운동일지가 없습니다",
        reason: "운동한 날짜를 선택해 첫 기록을 남겨 보세요.",
        action: { label: "운동일지 작성", openJournal: state.selectedJournalDate || localDateKey() },
        compact: true,
      });
  renderListPager("practiceLogsPager", "practice", practicePage, practiceItems.length);
}

function renderJournalCalendar() {
  const target = $("#journalCalendar");
  if (!target) return;
  const todayValue = localDateKey();
  const selectedDate = state.selectedJournalDate || todayValue;
  const monthValue = state.activeJournalMonth || selectedDate.slice(0, 7);
  const [yearText, monthText] = monthValue.split("-");
  const year = Number(yearText);
  const monthIndex = Number(monthText) - 1;
  const dayCount = new Date(year, monthIndex + 1, 0).getDate();
  const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
  const query = (state.journalSearchQuery || "").trim();
  const entries = journalEntries();
  const lessonDates = new Set(entries.filter((entry) => entry.kind === "레슨" && entry.dateValue?.startsWith(monthValue)).map((entry) => entry.dateValue));
  const entriesByDate = entries.reduce((map, entry) => {
    if (!entry.dateValue?.startsWith(monthValue) || !journalMatchesSearch(entry, query)) return map;
    if (!map.has(entry.dateValue)) map.set(entry.dateValue, []);
    map.get(entry.dateValue).push(entry);
    return map;
  }, new Map());
  const weekdays = ["월", "화", "수", "목", "금", "토", "일"].map((day) => `<b>${day}</b>`).join("");
  const emptyMarkup = Array.from({ length: firstWeekday }, () => `<span class="calendar-empty"></span>`).join("");
  const daysMarkup = Array.from({ length: dayCount }, (_, index) => {
    const day = index + 1;
    const dateValue = `${monthValue}-${String(day).padStart(2, "0")}`;
    const dayEntries = entriesByDate.get(dateValue) || [];
    const hasRecord = dayEntries.length > 0;
    const hasLesson = lessonDates.has(dateValue);
    const entry = dayEntries[0];
    const label = dayEntries.length > 1 ? `${dayEntries.length}건` : entry?.kind || (hasLesson ? "수업" : "");
    const accessibleLabel = label || "기록 없음";
    return `
      <button class="journal-day ${hasRecord ? "has-record" : ""} ${hasLesson ? "has-lesson" : ""} ${selectedDate === dateValue ? "is-selected" : ""} ${query && hasRecord ? "matches-search" : ""}" type="button" data-select-journal-date="${dateValue}" aria-label="${dateValue} ${accessibleLabel}">
        <strong>${day}</strong>
        ${label ? `<span>${label}</span>` : ""}
      </button>`;
  }).join("");
  target.innerHTML = `<div class="calendar-weekdays">${weekdays}</div><div class="calendar-days">${emptyMarkup}${daysMarkup}</div>`;
  const monthLabel = $("#journalMonthLabel");
  if (monthLabel) monthLabel.textContent = `${year}년 ${monthIndex + 1}월`;
  const controlLabel = $("#journalCalendarControlLabel");
  const visibleMonthLabel = `${year}년 ${monthIndex + 1}월`;
  if (controlLabel) controlLabel.textContent = visibleMonthLabel;
  const monthPickerButton = $("#journalMonthPickerButton");
  if (monthPickerButton) monthPickerButton.setAttribute("aria-label", `${visibleMonthLabel}, 연·월 선택`);
  const jumpInput = $("#journalJumpDate");
  if (jumpInput && jumpInput.value !== selectedDate) jumpInput.value = selectedDate;
  const searchInput = $("#journalSearch");
  if (searchInput && searchInput.value !== query) searchInput.value = query;
  renderSelectedJournalDayPanel();
}

function renderJournalActivitySummary() {
  const target = $("#journalActivitySummary");
  if (!target) return;
  const items = journalActivityItems();
  target.innerHTML = journalActivityStatuses.map((definition) => {
    const matches = items.filter((item) => item.status === definition.key);
    return `
      <button class="journal-activity-chip" type="button" data-journal-activity-status="${definition.key}" ${matches.length ? "" : "disabled"}>
        <span>${definition.label()}</span>
        <strong>${matches.length}</strong>
      </button>`;
  }).join("");
}

function renderSelectedJournalCard(entry) {
  const statusText = entry.note && entry.note !== "개인 기록" ? entry.note : entry.kind === "레슨" ? "수업 기록" : "개인 기록";
  return `
    <article class="journal-selected-card ${entry.kind === "레슨" ? "lesson" : "practice"}">
      <div class="journal-selected-card-head">
        <span>${entry.kind}</span>
        <strong>${entry.title}</strong>
        <small>${entry.subtitle || entry.dateLabel}</small>
      </div>
      <div class="journal-selected-card-action">
        <span>${statusText}${entry.mediaNames?.length ? ` · 첨부 ${entry.mediaNames.length}개` : ""}</span>
        <button class="small-button" type="button" data-open-journal-detail="${entry.id}">내용 보기</button>
      </div>
    </article>`;
}

function renderSelectedJournalDayPanel() {
  const target = $("#journalSelectedDayPanel");
  if (!target) return;
  const selectedDate = state.selectedJournalDate || localDateKey();
  const dateLabel = new Date(`${selectedDate}T00:00:00`).toLocaleDateString("ko-KR", { month: "long", day: "numeric", weekday: "short" });
  const query = (state.journalSearchQuery || "").trim();
  const entries = selectedJournalEntries();
  target.innerHTML = `
    <div class="journal-selected-heading">
      <div>
        <strong>${dateLabel}</strong>
        <span>${query ? `"${query}" 검색 결과` : "선택한 날짜 기록"}</span>
      </div>
      <button class="small-button" type="button" data-journal-write-date="${selectedDate}">이 날짜에 기록</button>
    </div>
    <div class="journal-selected-list">
      ${entries.length ? entries.map(renderSelectedJournalCard).join("") : memberEmptyState({
        title: "이 날짜의 운동 기록이 없습니다",
        reason: "레슨 또는 개인운동 내용을 사진·영상과 함께 남길 수 있습니다.",
        compact: true,
      })}
    </div>`;
}
