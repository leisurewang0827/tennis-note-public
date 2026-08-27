/**
 * 최상위 함수의 진짜 범위를 찾는다.
 *
 * 이 저장소의 스크립트는 최상위 함수가 항상 열 0 의 `}` 한 글자로 끝난다.
 * (app.js 1,149개 전부 이 규칙을 지킨다.)
 *
 * "다음 function 선언까지"로 범위를 잡으면 그 사이의 최상위 코드까지
 * 함수 본문으로 오인한다. 실제로 그 오인 때문에 함수 밖 코드의 식별자가
 * 치환되어 배포 직전까지 갈 뻔했다.
 *
 *   function makeTimeRange(..., allScheduleSettings = scheduleSettings) { ... }
 *
 *   const scheduleTimes = [
 *     ...makeTimeRange(allScheduleSettings.openStart, ...),  // <- 함수 밖. 터진다.
 *   ];
 *
 * 중괄호를 세는 방법도 써봤지만 정규식 리터럴(/[&<>"']/g) 안의 따옴표를
 * 문자열 시작으로 오인해 실패했다. 열 0 의 `}` 규칙이 여기서는 더 정확하다.
 */
export function topLevelFunctions(source) {
  const lines = source.split("\n");
  const result = [];
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^(?:async )?function ([A-Za-z0-9_]+)/.exec(lines[i]);
    if (!match) continue;
    let end = -1;
    for (let j = i + 1; j < lines.length; j += 1) {
      if (lines[j] === "}") { end = j; break; }
    }
    if (end < 0) continue;
    result.push({ name: match[1], startLine: i, endLine: end, text: lines.slice(i, end + 1).join("\n") });
  }
  return result;
}

/** 어느 함수에도 속하지 않는 줄 번호 집합 (0-based). */
export function topLevelLines(source) {
  const lines = source.split("\n");
  const inside = new Set();
  for (const fn of topLevelFunctions(source)) {
    for (let i = fn.startLine; i <= fn.endLine; i += 1) inside.add(i);
  }
  const outside = [];
  for (let i = 0; i < lines.length; i += 1) if (!inside.has(i)) outside.push(i);
  return outside;
}
