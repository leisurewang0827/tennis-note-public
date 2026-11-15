"use strict";
// 한 파일에 섞인 현재 동작 검사와 과거 원본 검사의 누락·중복을 차단합니다.
const currentPattern = "^(admin |manual |coach |actual assembled)";
const historicalPattern = "^(selected|new adapters|HTML/module)";
function verifySelectedRouting(source) {
  const names = [...source.matchAll(/^test\("([^"\n]+)"/gm)].map(match => match[1]);
  if (!names.length || new Set(names).size !== names.length) throw Error("검사 이름 누락 또는 중복");
  const current = new RegExp(currentPattern), historical = new RegExp(historicalPattern);
  for (const name of names) {
    if (Number(current.test(name)) + Number(historical.test(name)) !== 1) {
      throw Error(`현재/과거 검사 분류 필요: ${name}`);
    }
  }
  return { current: names.filter(name => current.test(name)), historical: names.filter(name => historical.test(name)) };
}
module.exports = { currentPattern, historicalPattern, verifySelectedRouting };
