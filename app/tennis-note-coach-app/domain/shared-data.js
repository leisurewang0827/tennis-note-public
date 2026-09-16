// 데모 모드에서 회원·관리자와 함께 쓰는 저장소를 읽고 쌓는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function importMemberLessonLogs() {
  const shared = loadSharedData();
  shared.lessonLogs.forEach((sharedLog) => {
    const existing = state.lessonLogs.find((log) => log.id === sharedLog.id);
    const mappedStatus = sharedLog.status === "confirmed" ? "확인 완료" : "확인 대기";
    if (existing) {
      existing.content = sharedLog.content;
      existing.selfMemo = sharedLog.selfMemo;
      existing.curriculumId = sharedLog.curriculumId;
      existing.nextCurriculumId = sharedLog.nextCurriculumId || sharedLog.curriculumId;
      existing.coachComment = sharedLog.coachComment || existing.coachComment || "";
      existing.status = mappedStatus;
      existing.completedAt = sharedLog.confirmedAt || existing.completedAt || "";
      return;
    }
    state.lessonLogs.unshift({
      id: sharedLog.id,
      member: sharedLog.member || "김서준",
      lesson: sharedLog.lessonLabel,
      content: sharedLog.content,
      selfMemo: sharedLog.selfMemo,
      curriculumId: sharedLog.curriculumId,
      nextCurriculumId: sharedLog.nextCurriculumId || sharedLog.curriculumId,
      coachComment: sharedLog.coachComment || "",
      validationMessage: "",
      status: mappedStatus,
      completedAt: sharedLog.confirmedAt || "",
    });
  });
}

function importPracticeFeedbackRequests() {
  const shared = loadSharedData();
  shared.feedbackRequests.forEach((request) => {
    const existing = state.feedbackRequests.find((item) => item.id === request.id);
    if (existing) {
      Object.assign(existing, request);
      return;
    }
    state.feedbackRequests.unshift({ ...request, validationMessage: "" });
  });
}

function importMakeupRequests() {
  const shared = loadSharedData();
  shared.makeupRequests.forEach((request) => {
    const existing = state.makeupRequests.find((item) => item.id === request.id);
    const payload = {
      id: request.id,
      member: request.member || "회원",
      original: request.original || "기존 수업",
      requested: request.requested || "희망 시간",
      reason: request.reason || "",
      policy: request.policy || "",
      status: request.status === "자동 변경 완료" ? "승인 완료" : request.status || "승인 대기",
    };
    if (existing) Object.assign(existing, payload);
    else state.makeupRequests.unshift(payload);
  });
}

function importNtrpRequests() {
  const shared = loadSharedData();
  state.ntrpRequests = shared.ntrpRequests || [];
  state.ntrpRequests.forEach((request) => {
    const member = state.members.find((item) => item.name === request.member);
    if (!member) return;
    member.selfNtrp = request.selfNtrp;
    member.coachNtrp = request.coachNtrp || member.coachNtrp || "측정 전";
    member.ntrpRequest = request.status === "측정 완료" ? "완료" : "요청";
    member.ntrpSurvey = request.surveyAnswers || {};
    member.ntrpGoal = request.goal || "";
    member.ntrpMemo = request.memo || "";
  });
}

function exportNtrpResult(request) {
  const shared = loadSharedData();
  const index = shared.ntrpRequests.findIndex((item) => item.id === request.id);
  const payload = {
    ...request,
    status: "측정 완료",
    answeredAt: new Date().toISOString(),
  };
  if (index >= 0) shared.ntrpRequests[index] = { ...shared.ntrpRequests[index], ...payload };
  else shared.ntrpRequests.unshift(payload);
  saveSharedData(shared);
}

function exportPracticeFeedback(request) {
  const shared = loadSharedData();
  const index = shared.feedbackRequests.findIndex((item) => item.id === request.id);
  const payload = {
    ...request,
    status: "코치 답변 완료",
    answeredAt: new Date().toISOString(),
  };
  if (index >= 0) shared.feedbackRequests[index] = { ...shared.feedbackRequests[index], ...payload };
  else shared.feedbackRequests.unshift(payload);
  saveSharedData(shared);
}

function exportConfirmedLog(log) {
  const shared = loadSharedData();
  const index = shared.lessonLogs.findIndex((item) => item.id === log.id);
  const nextStep = selectedCurriculum(log.nextCurriculumId);
  const payload = {
    id: log.id,
    member: log.member,
    lessonLabel: log.lesson,
    content: log.content,
    selfMemo: log.selfMemo,
    curriculumId: log.curriculumId,
    nextCurriculumId: log.nextCurriculumId,
    coachComment: log.coachComment,
    memberVisibleSummary: `다음 수업 등록 완료: ${nextStep.id} · ${nextStep.title}`,
    curriculumRegistered: true,
    status: "confirmed",
    confirmedAt: new Date().toISOString(),
  };
  if (index >= 0) shared.lessonLogs[index] = { ...shared.lessonLogs[index], ...payload };
  else shared.lessonLogs.unshift(payload);
  saveSharedData(shared);
}

function ensureTodayLessonDashboard() {
  if (state.dataMode === "live") return;
  if (Number(state.dashboardVersion) >= 5 && state.todayLessons.length >= 8 && state.todayLessons.every((lesson) => lesson.day && lesson.ticket && lesson.task && lesson.coach)) return;
  state.dashboardVersion = 6;
  state.todayLessons = [
    { id: "lesson-1", day: "월", time: "18:40", coach: "노 코치", member: "김서준", type: "정규 20분", ticket: "개인레슨 10회", status: "예정", remaining: 8, task: "수업 후 코멘트/다음 커리큘럼" },
    { id: "lesson-2", day: "월", time: "19:00", coach: "강 코치", member: "최유나&이하린", type: "정규 30분", ticket: "2대1 8회", status: "예정", remaining: 6, task: "파트너 출석 같이 확인" },
    { id: "lesson-2b", day: "월", time: "19:00", coach: "노 코치", member: "윤서준", type: "정규 20분", ticket: "개인레슨 8회", status: "예정", remaining: 3, task: "동시간 수업 확인" },
    { id: "lesson-3", day: "화", time: "19:40", coach: "노 코치", member: "오윤정", type: "정규 20분", ticket: "주2회 12회", status: "예정", remaining: 11, task: "요일/시간 고정 확인" },
    { id: "lesson-4", day: "수", time: "20:00", coach: "황 코치", member: "이하린", type: "정규 20분", ticket: "개인레슨 8회", status: "예정", remaining: 2, task: "재등록 안내 필요" },
    { id: "lesson-5", day: "목", time: "20:20", coach: "강 코치", member: "박민재", type: "보강 30분", ticket: "개인레슨 10회", status: "승인됨", remaining: 5, task: "보강 수업 처리" },
    { id: "lesson-6", day: "금", time: "20:50", coach: "노 코치", member: "강다현", type: "정규 30분", ticket: "주1회 8회", status: "예정", remaining: 7, task: "수업 후 영상 피드백 확인" },
    { id: "lesson-7", day: "토", time: "18:40", coach: "박창준 코치", member: "임현우", type: "정규 30분", ticket: "주말반 8회", status: "예정", remaining: 4, task: "주말반 커리큘럼 확인" },
  ];
}

function ensureCoachDemoConsistency() {
  if (state.dataMode === "live") return;
  state.todayLessons.forEach((lesson) => {
    if (shortCoachName(lesson.coach) === "박창준") lesson.coach = "박창준 코치";
    if ((lesson.day === "토" || lesson.day === "일") && lesson.member === "박민재") lesson.coach = "박창준 코치";
    if (lesson.member === "박민재" && lesson.ticket?.includes("황")) {
      lesson.ticket = "박창준 코치 주 1회 개인 30분";
    }
  });
  state.members?.forEach((member) => {
    if (member.name === "박민재" && member.ticket?.includes("황")) {
      member.coach = "박창준 코치";
      member.ticket = "박창준 코치 주 1회 개인 30분";
    }
  });
  state.expiredMembers?.forEach((member) => {
    if (member.name === "박민재" && member.ticket?.includes("황")) {
      member.coach = "박창준 코치";
      member.ticket = "박창준 코치 주 1회 개인 30분";
    }
  });
  state.dashboardVersion = 6;
}

function ensureMemberLists() {
  if (state.dataMode === "live") {
    if (!Array.isArray(state.members)) state.members = [];
    if (!Array.isArray(state.expiredMembers)) state.expiredMembers = [];
    if (!Array.isArray(state.proxySettlements)) state.proxySettlements = [];
    if (!state.coachProfiles) state.coachProfiles = {};
    return;
  }
  if (!state.branchPermissions) {
    state.branchPermissions = {
      branch: "어린이대공원점",
      schedule: "같은 지점 전체 시간표 공유",
      memberRecords: "같은 지점 회원정보와 수업기록 열람",
      finance: "결제/전체매출/환불은 관리자만",
    };
  }
  if (!Array.isArray(state.proxySettlements) || !state.proxySettlements.length) {
    state.proxySettlements = [
      { id: "proxy-1", originalCoach: "노 코치", actualCoach: "황 코치", member: "박민재", lesson: "목 20:20 대타 30분", base: 180000, amount: 35000, status: "정산 이관 대기" },
      { id: "proxy-2", originalCoach: "강 코치", actualCoach: "노 코치", member: "최유나&이하린", lesson: "월 19:00 대타 20분", base: 180000, amount: 90000, status: "관리자 확인 필요" },
    ];
  }
  if (!Array.isArray(state.members) || !state.members.length) {
    state.members = [
      { id: "member-1", name: "김서준", coach: "노 코치", ticket: "개인레슨 10회", remaining: 8, status: "수강중", lastLesson: "월 18:40", selfNtrp: "2.5", coachNtrp: "측정 전", ntrpRequest: "요청" },
      { id: "member-2", name: "윤서준", coach: "노 코치", ticket: "개인레슨 8회", remaining: 3, status: "수강중", lastLesson: "월 19:00", selfNtrp: "3.0", coachNtrp: "2.5", ntrpRequest: "완료" },
      { id: "member-3", name: "최유나&이하린", coach: "강 코치", ticket: "2대1 8회", remaining: 6, status: "수강중", lastLesson: "월 19:00", selfNtrp: "2.0", coachNtrp: "측정 전", ntrpRequest: "미요청" },
      { id: "member-4", name: "이하린", coach: "황 코치", ticket: "개인레슨 8회", remaining: 2, status: "수강중", lastLesson: "수 20:00", selfNtrp: "3.0", coachNtrp: "3.0", ntrpRequest: "완료" },
    ];
  }
  if (!Array.isArray(state.expiredMembers) || !state.expiredMembers.length) {
    state.expiredMembers = [
      { id: "expired-1", name: "박준영", coach: "노 코치", ticket: "개인레슨 8회", expiredAt: "2026-06-18", used: "8/8", note: "연장 안내 필요" },
      { id: "expired-2", name: "정다은", coach: "강 코치", ticket: "그룹레슨 8회", expiredAt: "2026-06-24", used: "8/8", note: "7월 재등록 미정" },
      { id: "expired-3", name: "한지호", coach: "황 코치", ticket: "주말반 4회", expiredAt: "2026-06-29", used: "4/4", note: "주말 시간 재문의" },
    ];
  }
  if (!state.coachProfiles) {
    state.coachProfiles = {};
  }
  approvedCoachesFromAdmin().forEach((coach) => {
    if (!state.coachProfiles[coach.name]) {
      state.coachProfiles[coach.name] = {
        intro: "회원에게 보여줄 코치 소개를 입력해주세요.",
        specialty: coach.role || "레슨",
        lessonStyle: "회원 수준에 맞춘 맞춤 수업",
        availableMemo: "관리자 설정 가능 시간 기준",
        memberMessage: "수업 전 궁금한 점을 편하게 남겨주세요.",
      };
    }
  });
}

function compactCoachSnapshotState() {
  const compactMember = (member) => {
    const compact = { ...member };
    if (String(compact.photoUrl || "").startsWith("data:")) delete compact.photoUrl;
    if (String(compact.profilePhotoUrl || "").startsWith("data:")) delete compact.profilePhotoUrl;
    return compact;
  };
  const snapshotState = {
    ...state,
    coach: state.coach ? { ...state.coach } : null,
    coachSettlement: null,
    coachSettlementLoading: false,
    coachSettlementError: "",
    members: (state.members || []).map(compactMember),
    expiredMembers: (state.expiredMembers || []).map(compactMember),
    coachProfiles: Object.fromEntries(
      Object.entries(state.coachProfiles || {}).map(([name, profile]) => [name, { ...profile }]),
    ),
  };
  const activePhoto = String(snapshotState.coach?.profilePhotoUrl || "");
  if (activePhoto) {
    Object.values(snapshotState.coachProfiles).forEach((profile) => {
      if (profile.photo === activePhoto) delete profile.photo;
    });
  }
  return snapshotState;
}

function exportMakeupRequest(request) {
  const shared = loadSharedData();
  const payload = {
    id: request.id,
    member: request.member,
    original: request.original,
    requested: request.requested,
    reason: request.reason || "",
    policy: request.policy || "",
    status: request.status,
    answeredAt: new Date().toISOString(),
    source: "coach-app",
  };
  const index = shared.makeupRequests.findIndex((item) => item.id === request.id);
  if (index >= 0) shared.makeupRequests[index] = { ...shared.makeupRequests[index], ...payload };
  else shared.makeupRequests.unshift(payload);
  saveSharedData(shared);
}
