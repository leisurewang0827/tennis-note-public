// 데모 모드에서 회원·코치·관리자가 함께 쓰는 저장소에 쌓는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function saveSharedData(shared) {
  safeLocalStorageSet(sharedStorageKey, JSON.stringify(shared));
}

function pushMakeupRequestToShared(request) {
  const shared = loadSharedData();
  const payload = {
    id: request.id,
    member: currentMemberName(),
    original: request.absence,
    requested: request.makeup,
    reason: request.reason,
    policy: request.policy,
    status: request.status.includes("자동") ? "자동 변경 완료" : "승인 대기",
    requestedAt: new Date().toISOString(),
    source: "member-app",
  };
  shared.makeupRequests = [
    payload,
    ...(shared.makeupRequests || []).filter((item) => item.id !== payload.id),
  ].slice(0, 30);
  saveSharedData(shared);
}

function pushLessonLogToShared(log) {
  const shared = loadSharedData();
  const payload = {
    id: log.id,
    member: "김서준",
    lessonLabel: log.lessonLabel,
    content: log.content,
    selfMemo: log.selfMemo,
    curriculumId: log.curriculum.id,
    nextCurriculumId: log.nextCurriculumId || log.curriculum.id,
    coachComment: log.coachComment || "",
    memberVisibleSummary: log.memberVisibleSummary || "",
    mediaNames: log.mediaNames || [],
    mediaItems: normalizeMediaItems(log).map((item) => ({ name: item.name, type: item.type })),
    journalDate: log.journalDate,
    status: log.status,
    submittedAt: log.submittedAt,
  };
  const index = shared.lessonLogs.findIndex((item) => item.id === payload.id);
  if (index >= 0) shared.lessonLogs[index] = payload;
  else shared.lessonLogs.unshift(payload);
  saveSharedData(shared);
}

function pushPracticeFeedbackToShared(log) {
  const shared = loadSharedData();
  const payload = {
    id: log.id,
    member: "김서준",
    type: log.type,
    date: log.date,
    memo: log.memo,
    next: log.next,
    question: log.feedbackQuestion,
    mediaNames: log.mediaNames,
    mediaItems: normalizeMediaItems(log).map((item) => ({ name: item.name, type: item.type })),
    coachFeedback: log.coachFeedback || "",
    status: log.feedbackStatus,
    submittedAt: log.submittedAt,
  };
  const index = shared.feedbackRequests.findIndex((item) => item.id === payload.id);
  if (index >= 0) shared.feedbackRequests[index] = payload;
  else shared.feedbackRequests.unshift(payload);
  saveSharedData(shared);
}
