import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// 전역을 매개변수로 바꾸는 작업(기본값 이음매)에서 실제로 난 사고:
//
//   function f(row, sourceMembers = members) {
//     ...
//     allMembers.push(member);   // <- 매개변수를 지웠는데 본문에 이름이 남았다
//   }
//
// allMembers 는 어디에도 정의돼 있지 않다. 그 줄이 실행될 때만 터지므로
// 문법 검사도, 화면을 잠깐 눌러보는 것도 못 잡는다.
//
// 이음매에 쓰는 매개변수 이름(all* 접두사)이 그 함수의 매개변수 목록에
// 없는데 본문에서 쓰이면 잡아낸다.

const SOURCES = [
  "app/admin/app.js",
  "app/admin/schedule-v2-admin.js",
  "app/admin/domain/values.js",
  "app/admin/domain/lessons.js",
  "app/admin/domain/billing.js",
  "app/tennis-note-member-app/app.js",
  "app/tennis-note-coach-app/app.js",
];

const SEAM_PARAM = /^all[A-Z][A-Za-z0-9_]*$/;

/** 최상위 함수 하나하나를 (이름, 매개변수 목록, 본문) 으로 쪼갠다. */
function topLevelFunctions(source) {
  const lines = source.split("\n");
  const found = [];
  let start = null;
  let name = null;
  for (let i = 0; i < lines.length; i += 1) {
    const match = /^(?:async )?function ([A-Za-z0-9_]+)/.exec(lines[i]);
    if (!match) continue;
    if (start !== null) found.push({ name, text: lines.slice(start, i).join("\n") });
    start = i;
    name = match[1];
  }
  if (start !== null) found.push({ name, text: lines.slice(start).join("\n") });
  return found;
}

function paramNames(text) {
  const signature = /^(?:async )?function [A-Za-z0-9_]+\s*\(([\s\S]*?)\)\s*\{/.exec(text);
  if (!signature) return new Set();
  return new Set(
    signature[1]
      .split(/,(?![^([{]*[)\]}])/)
      .map((part) => /^\s*\{?\s*([A-Za-z_$][A-Za-z0-9_$]*)/.exec(part)?.[1])
      .filter(Boolean),
  );
}

for (const relativePath of SOURCES) {
  test(`${relativePath} — 이음매 매개변수가 정의 없이 쓰이지 않는다`, () => {
    const source = readFileSync(join(repoRoot, relativePath), "utf8");
    const problems = [];

    // all* 로 시작하는 최상위 함수·변수가 있다 (allTicketsForMember 등).
    // 이음매 매개변수가 아니라 정상적인 이름이므로 제외한다.
    const moduleScope = new Set([
      ...[...source.matchAll(/^(?:async )?function ([A-Za-z0-9_]+)/gm)].map((m) => m[1]),
      ...[...source.matchAll(/^(?:const|let|var) ([A-Za-z0-9_$]+)/gm)].map((m) => m[1]),
    ]);

    for (const fn of topLevelFunctions(source)) {
      const params = paramNames(fn.text);
      const bodyStart = fn.text.indexOf("{");
      const body = bodyStart >= 0 ? fn.text.slice(bodyStart) : fn.text;
      const locals = new Set(
        [...body.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g)].map((m) => m[1]),
      );

      for (const used of new Set([...body.matchAll(/(?<![\w.$])(all[A-Z][A-Za-z0-9_]*)(?![\w$])/g)].map((m) => m[1]))) {
        if (!SEAM_PARAM.test(used)) continue;
        if (params.has(used) || locals.has(used) || moduleScope.has(used)) continue;
        problems.push(`${fn.name}() 안에서 ${used} 를 쓰는데 매개변수에도 지역 변수에도 없다`);
      }
    }

    assert.deepEqual(problems, [], `정의되지 않은 이름:\n  ${problems.join("\n  ")}`);
  });
}
