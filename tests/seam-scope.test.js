import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { topLevelFunctions, topLevelLines } from "./helpers/top-level-functions.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// 실제로 난 사고:
//
//   function makeTimeRange(..., allScheduleSettings = scheduleSettings) { ... }
//
//   const scheduleTimes = [
//     ...makeTimeRange(allScheduleSettings.openStart, ...),   // <- 함수 밖
//   ];
//
// 이음매 매개변수 이름이 함수 밖으로 새면 그 줄은 로드하자마자 터진다.
//   Uncaught ReferenceError: allScheduleSettings is not defined
//
// node --check 는 통과한다. 문법은 멀쩡하기 때문이다.
// 데이터 객체의 속성 이름(members: -> allMembers:)이 바뀐 경우는 더 조용하다.
// 터지지도 않고 그 필드를 읽는 코드가 undefined 를 보게 된다.

const SOURCES = [
  "app/admin/app.js",
  "app/admin/schedule-v2-admin.js",
  "app/admin/domain/values.js",
  "app/admin/domain/lessons.js",
  "app/admin/domain/billing.js",
  "app/admin/domain/tickets.js",
  "app/admin/domain/coaches.js",
  "app/admin/domain/schedule.js",
  "app/admin/domain/payment.js",
  "app/admin/domain/policy.js",
  "app/admin/domain/record.js",
  "app/admin/domain/members.js",
  "app/admin/domain/common.js",
  "app/admin/events/billing.js",
  "app/admin/events/common.js",
  "app/admin/events/data.js",
  "app/admin/events/delegated.js",
  "app/admin/events/members.js",
  "app/admin/events/notes.js",
  "app/admin/events/reports.js",
  "app/admin/events/schedule.js",
  "app/admin/events/settings.js",
  "app/admin/views/billing.js",
  "app/admin/views/common.js",
  "app/admin/views/dashboard.js",
  "app/admin/views/data.js",
  "app/admin/views/makeup.js",
  "app/admin/views/members.js",
  "app/admin/views/notes.js",
  "app/admin/views/reports.js",
  "app/admin/views/schedule.js",
  "app/admin/views/settings.js",
  "app/tennis-note-member-app/settings.js",
  "app/tennis-note-member-app/catalog.js",
  "app/tennis-note-member-app/domain/products.js",
  "app/tennis-note-member-app/domain/identity.js",
  "app/tennis-note-member-app/domain/journal.js",
  "app/tennis-note-member-app/domain/curriculum.js",
  "app/tennis-note-member-app/domain/payment.js",
  "app/tennis-note-member-app/domain/purchase.js",
  "app/tennis-note-member-app/domain/tickets.js",
  "app/tennis-note-member-app/domain/policy.js",
  "app/tennis-note-member-app/domain/lessons.js",
  "app/tennis-note-member-app/domain/changes.js",
  "app/tennis-note-member-app/domain/schedule.js",
  "app/tennis-note-member-app/domain/coaches.js",
  "app/tennis-note-member-app/domain/shared-data.js",
  "app/tennis-note-member-app/domain/notices.js",
  "app/tennis-note-member-app/domain/values.js",
  "app/tennis-note-member-app/views/home.js",
  "app/tennis-note-member-app/views/schedule.js",
  "app/tennis-note-member-app/views/profile.js",
  "app/tennis-note-member-app/views/tickets.js",
  "app/tennis-note-member-app/views/products.js",
  "app/tennis-note-member-app/views/journal.js",
  "app/tennis-note-member-app/views/curriculum.js",
  "app/tennis-note-member-app/views/requests.js",
  "app/tennis-note-member-app/events/delegated.js",
  "app/tennis-note-member-app/events/account.js",
  "app/tennis-note-member-app/events/makeup.js",
  "app/tennis-note-member-app/events/journal.js",
  "app/tennis-note-member-app/events/profile.js",
  "app/tennis-note-member-app/events/schedule.js",
  "app/tennis-note-member-app/events/home.js",
  "app/tennis-note-member-app/data/auth.js",
  "app/tennis-note-member-app/data/sync.js",
  "app/tennis-note-member-app/data/push.js",
  "app/tennis-note-member-app/data/payment.js",
  "app/tennis-note-member-app/data/journal.js",
  "app/tennis-note-member-app/ui/sheet.js",
  "app/tennis-note-member-app/ui/screens.js",
  "app/tennis-note-member-app/storage.js",
  "app/tennis-note-member-app/actions/requests.js",
  "app/tennis-note-member-app/actions/enrollment.js",
  "app/tennis-note-member-app/actions/profile.js",
  "app/tennis-note-member-app/actions/journal.js",
  "app/tennis-note-member-app/actions/payment.js",
  "app/tennis-note-member-app/actions/session.js",
  "app/tennis-note-member-app/app.js",
  "app/tennis-note-coach-app/domain/values.js",
  "app/tennis-note-coach-app/domain/schedule.js",
  "app/tennis-note-coach-app/domain/policy.js",
  "app/tennis-note-coach-app/domain/coaches.js",
  "app/tennis-note-coach-app/domain/lessons.js",
  "app/tennis-note-coach-app/domain/records.js",
  "app/tennis-note-coach-app/domain/members.js",
  "app/tennis-note-coach-app/domain/schedule-v2.js",
  "app/tennis-note-coach-app/domain/notices.js",
  "app/tennis-note-coach-app/domain/curriculum.js",
  "app/tennis-note-coach-app/domain/settlement.js",
  "app/tennis-note-coach-app/domain/makeup.js",
  "app/tennis-note-coach-app/domain/shared-data.js",
  "app/tennis-note-coach-app/domain/tasks.js",
  "app/tennis-note-coach-app/views/home.js",
  "app/tennis-note-coach-app/views/schedule.js",
  "app/tennis-note-coach-app/views/members.js",
  "app/tennis-note-coach-app/views/records.js",
  "app/tennis-note-coach-app/views/curriculum.js",
  "app/tennis-note-coach-app/views/settlement.js",
  "app/tennis-note-coach-app/views/profile.js",
  "app/tennis-note-coach-app/events/account.js",
  "app/tennis-note-coach-app/events/delegated.js",
  "app/tennis-note-coach-app/app.js",
];

const SEAM_NAME = /(?<![\w.$])(all[A-Z][A-Za-z0-9_]*)(?![\w$])/g;

for (const relativePath of SOURCES) {
  test(`${relativePath} — 이음매 이름이 함수 밖으로 새지 않는다`, () => {
    const source = readFileSync(join(repoRoot, relativePath), "utf8");
    const lines = source.split("\n");

    // all* 로 시작하는 정상적인 이름들은 제외한다.
    // - 최상위 함수·변수 (allTicketsForMember 등)
    // - 어디서든 const/let/var 로 선언된 것 (중첩 함수 안의 allDay 등)
    // 이음매 매개변수는 매개변수일 뿐 어디서도 선언되지 않으므로 남는다.
    const declared = new Set([
      ...[...source.matchAll(/^(?:async )?function ([A-Za-z0-9_]+)/gm)].map((m) => m[1]),
      ...[...source.matchAll(/\b(?:const|let|var)\s+([A-Za-z_$][A-Za-z0-9_$]*)/g)].map((m) => m[1]),
    ]);

    const leaks = [];
    for (const index of topLevelLines(source)) {
      for (const match of lines[index].matchAll(SEAM_NAME)) {
        if (declared.has(match[1])) continue;
        leaks.push(`${index + 1}행: ${match[1]} — ${lines[index].trim().slice(0, 60)}`);
      }
    }

    assert.deepEqual(leaks, [], `함수 밖에서 쓰이는 이음매 이름:\n  ${leaks.join("\n  ")}`);
  });
}

test("함수 범위 판정이 이 저장소 스타일과 맞는다", () => {
  // 최상위 함수는 열 0 의 `}` 로 끝난다는 가정 위에서 위 검사가 성립한다.
  // 스타일이 바뀌면 검사가 조용히 무력해지므로 가정 자체를 확인한다.
  for (const relativePath of SOURCES) {
    const source = readFileSync(join(repoRoot, relativePath), "utf8");
    const declarations = (source.match(/^(?:async )?function [A-Za-z0-9_]+/gm) || []).length;
    const parsed = topLevelFunctions(source).length;
    assert.equal(parsed, declarations, `${relativePath}: 함수 ${declarations}개 중 ${parsed}개만 범위를 찾았다`);
  }
});
