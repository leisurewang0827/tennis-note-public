// 보강 요청과 보강권을 다루는 함수들.
//
// 화면(DOM)을 직접 만지지 않고 서버도 부르지 않는다. 값을 받아 판정해 돌려준다.
// 일부는 app.js 에 남은 읽기 도우미를 부른다. 그 이름은 호출 시점에 해석되므로
// 동작에는 문제가 없다.
// app.js 에서 본문 그대로 옮겨왔고 전역 함수 선언이라 호출부는 예전과 같다.

function pendingMakeupRequests() {
  return state.makeupRequests.filter((request) => request.status === "승인 대기");
}

function ownPendingMakeupRequests() {
  return pendingMakeupRequests().filter(makeupRequestBelongsToCurrentCoach);
}

function ownOpenMakeupEntitlements() {
  return (state.makeupEntitlements || []).filter((item) => (
    item.status === "open"
    && makeupRequestBelongsToCurrentCoach(item)
  ));
}

function getMakeupLinkedLog(member) {
  return state.lessonLogs.find((log) => log.member === member && log.status !== "확인 완료") || state.lessonLogs.find((log) => log.member === member);
}
