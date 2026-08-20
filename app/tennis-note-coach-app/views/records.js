// 수업 기록·보강 승인 화면을 그리는 함수들.
//
// 전역과 DOM 을 참조한다. app.js 보다 먼저 로드되지만 호출은 그 뒤에
// 일어나므로 이름은 호출 시점에 해석된다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function renderMakeupApprovalPanel() {
  const request = state.makeupRequests.find((item) => item.id === state.editingMakeupId);
  if (!request) {
    return `
      <section class="schedule-edit-panel is-empty">
        <strong>확인할 수업 변경 요청이 없습니다.</strong>
        <div class="actions">
          <button class="small-button" type="button" data-cancel-schedule-edit>닫기</button>
        </div>
      </section>`;
  }
  const linkedLog = getMakeupLinkedLog(request.member);
  const canReview = !request.serverRequestV2 || request.canReview;
  const rejectionWarning = "거절하면 원래 수업을 그대로 유지하며 회원권은 차감하지 않습니다. 거절 사유는 처리 결과로 남습니다.";
  return `
    <section class="schedule-edit-panel makeup-detail-panel">
      <div class="wide">
        <strong>${request.member} 수업 변경 승인</strong>
        <span>${request.original} → ${request.requested}</span>
      </div>
      <article class="modal-info-card">
        <span>현재 상태</span>
        <strong>${request.status}</strong>
        <small>${requestCoach(request)} 담당 요청입니다.</small>
      </article>
      <article class="modal-info-card">
        <span>연결 기록</span>
        <strong>${linkedLog ? linkedLog.lesson : "연결된 회원기록 없음"}</strong>
        <small>${linkedLog ? linkedLog.status : "승인 후 기록/차감 확인이 가능합니다."}</small>
      </article>
      <p class="permission-note wide">${rejectionWarning}</p>
      <div class="actions wide">
        ${linkedLog ? `<button class="small-button" type="button" data-open-linked-log="${request.id}">회원기록 보기</button>` : ""}
        ${canReview ? `<button class="approve-button" type="button" data-approve-makeup="${request.id}">승인</button>
        <button class="reject-button" type="button" data-reject-makeup="${request.id}">거절</button>` : '<span class="permission-note">관리자 승인 요청입니다.</span>'}
        <button class="small-button" type="button" data-cancel-schedule-edit>닫기</button>
      </div>
    </section>`;
}

function renderLessonRecordWritePanel() {
  const lessons = recordableCoachLessons();
  const lesson = ensureCoachLessonRecord(state.writingLessonId) || lessons[0];
  if (!lesson) {
    return `
      <section class="schedule-edit-panel is-empty">
        ${coachEmptyState({
          title: "작성할 수업이 없습니다",
          reason: "오늘 담당 수업이 등록된 뒤 기록과 차감을 처리할 수 있습니다.",
          action: { label: "오늘 일정 보기", view: "todayView", primary: false },
          compact: true,
        })}
        <div class="actions">
          <button class="small-button" type="button" data-cancel-schedule-edit>닫기</button>
        </div>
      </section>`;
  }
  return `
    <section class="schedule-edit-panel record-write-panel">
      <div class="wide">
        <strong>기록/차감 작성</strong>
        <span>수업 후 코멘트, 다음 커리큘럼, 회원권 차감을 코치가 직접 처리합니다.</span>
      </div>
      <label class="wide">
        <span>완료 처리할 수업</span>
        <select id="recordLessonSelect">${lessonRecordOptions(lesson.id)}</select>
      </label>
      <label class="wide">
        <span>오늘 레슨 내용</span>
        <textarea id="recordLessonContent" rows="3">${lesson.member} ${lesson.type} 수업 진행</textarea>
      </label>
      <label class="wide">
        <span>회원 운동노트/메모</span>
        <textarea id="recordSelfMemo" rows="3">회원 운동노트 미작성 · 코치가 기록/차감 메모를 먼저 작성했습니다.</textarea>
      </label>
      <label class="wide">
        <span>코치 코멘트</span>
        <textarea id="recordCoachComment" rows="3">오늘 레슨 확인 완료. 다음 시간에는 이어서 보완합니다.</textarea>
      </label>
      <label class="wide">
        <span>다음 커리큘럼 <small>필수</small></span>
        <input data-curriculum-option-search type="search" placeholder="증상·동작·목표·코드 검색" aria-label="다음 커리큘럼 검색" />
        <div class="tn-curriculum-suggestions" data-curriculum-option-suggestions role="listbox" hidden></div>
        <select id="recordNextCurriculum">${curriculumOptions(curriculumSteps[0]?.id)}</select>
      </label>
      <div class="actions wide">
        <button class="approve-button" type="button" data-save-lesson-record>저장하기</button>
        <button class="small-button" type="button" data-cancel-schedule-edit>닫기</button>
      </div>
    </section>`;
}

function renderMakeups() {
  const target = $("#makeupRequests");
  if (!target) return;
  const requests = state.makeupRequests.filter((request) => ["승인 대기", "pending"].includes(request.status));
  target.innerHTML =
    requests
      .map(
        (request) => `
          <article class="work-card ${state.focusedMakeupId === request.id ? "is-focused" : ""}" data-makeup-card="${request.id}">
            <div>
              <strong>${request.member}</strong>
              <span>${request.original} → ${request.requested}</span>
              <small>${request.policy || "24시간 이내 변경 승인 요청"}</small>
            </div>
            <div class="actions">
              <b>${request.status}</b>
              <button class="approve-button" type="button" data-open-makeup-detail="${request.id}">${request.serverRequestV2 && !request.canReview ? "요청 확인" : "승인 요청 확인"}</button>
            </div>
          </article>`,
      )
      .join("") || "<p class='empty-text'>확인할 수업 변경 요청이 없습니다.</p>";
}

function renderMemberRecordPanel() {
  const target = $("#memberRecordPanel");
  if (!target) return;
  importMemberLessonLogs();
  importPracticeFeedbackRequests();
  const pendingLogs = ownPendingLessonLogs().slice(0, 6);
  const pendingFeedback = ownPendingFeedbackRequests().slice(0, 4);
  if (!pendingLogs.length && !pendingFeedback.length) {
    target.hidden = true;
    target.innerHTML = "";
    return;
  }
  target.hidden = false;
  const logRows = pendingLogs
    .map(
      (log) => `
        <article class="member-record-row ${state.focusedLogId === log.id ? "is-focused" : ""}">
          <strong>${escapeHtml(log.member)}</strong>
          ${coachRecordLessonMetaMarkup(log)}
          <small>${escapeHtml(coachStatusLabel("coachRecord", log.status, log.status))}</small>
          <button class="small-button" type="button" data-focus-record="${log.id}">처리</button>
        </article>`,
    )
    .join("");
  const feedbackRows = pendingFeedback
    .map(
      (request) => `
        <article class="member-record-row">
          <strong>${request.member}</strong>
          <span>${request.date} · 운동노트 피드백</span>
          <small>${request.status}</small>
          <button class="small-button" type="button" data-summary-action="records">처리</button>
        </article>`,
    )
    .join("");
  target.innerHTML = `
    <section class="record-section">
      <div class="record-section-title">
        <strong>회원별 처리 일정</strong>
        <small>회원 관리에서는 대기 항목만 간단히 보고, 처리는 오늘 처리 일정에서 이어서 합니다.</small>
      </div>
      <div class="member-record-list">
        ${logRows || feedbackRows ? `${logRows}${feedbackRows}` : "<p class='empty-text'>처리 대기 중인 회원 기록이 없습니다.</p>"}
      </div>
    </section>`;
}

function renderLogs() {
  const markup = recordProcessingMarkup();
  if ($("#lessonLogs")) $("#lessonLogs").innerHTML = markup;
  if ($("#todayRecordPanel")) {
    $("#todayRecordPanel").hidden = todayTaskTab() !== "records";
    $("#todayRecordPanel").innerHTML = markup;
  }
  renderMemberRecordPanel();
}
