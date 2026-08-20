import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// 실제로 난 사고:
//
//   function memberCoachNames(member, allCoaches = coaches) { ... }
//   branchMembers.flatMap(memberCoachNames)
//
//   Uncaught TypeError: allCoaches.find is not a function
//
// map/flatMap/filter 같은 메서드는 콜백에 (요소, 인덱스, 배열) 을 넘긴다.
// 함수에 매개변수를 하나 추가하는 순간, 인덱스(숫자)가 그 자리로 들어간다.
// 호출부 코드는 한 글자도 안 바뀌었는데 의미가 바뀐다.
//
// 그래서 기본값 이음매는 "호출부에 영향이 없다"가 아니다.
// 콜백으로 넘겨지는 함수에는 영향이 있다.
//
// 해결은 호출부를 명시적으로 감싸는 것이다.
//   .flatMap((member) => memberCoachNames(member))

const SOURCES = [
  "app/admin/data/billing.js",
  "app/admin/data/common.js",
  "app/admin/data/member.js",
  "app/admin/data/schedule.js",
  "app/admin/data/settings.js",
  "app/admin/forms/coach.js",
  "app/admin/forms/common.js",
  "app/admin/forms/member.js",
  "app/admin/forms/schedule.js",
  "app/admin/actions/billing.js",
  "app/admin/actions/coach.js",
  "app/admin/actions/common.js",
  "app/admin/actions/member.js",
  "app/admin/actions/notice.js",
  "app/admin/actions/report.js",
  "app/admin/actions/schedule.js",
  "app/admin/actions/settings.js",
  "app/admin/ui/billing.js",
  "app/admin/ui/common.js",
  "app/admin/ui/member.js",
  "app/admin/ui/schedule.js",
  "app/admin/ui/settings.js",
  "app/admin/storage.js",
  "app/admin/views/tickets.js",
  "app/admin/forms/members.js",
  "app/admin/forms/policy.js",
  "app/admin/forms/tickets.js",
  "app/admin/app.js",
  "app/admin/schedule-v2-admin.js",
  "app/shared/tennisnote-escape-html.js",
  "app/admin/catalog.js",
  "app/admin/settings.js",
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
  "app/shared/tennisnote-escape-html.js",
  "app/shared/tennisnote-app-common.js",
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
  "app/tennis-note-member-app/domain/common.js",
  "app/tennis-note-member-app/domain/members.js",
  "app/tennis-note-member-app/views/common.js",
  "app/tennis-note-member-app/forms/common.js",
  "app/tennis-note-member-app/forms/members.js",
  "app/tennis-note-member-app/forms/notices.js",
  "app/tennis-note-member-app/forms/payment.js",
  "app/tennis-note-member-app/forms/schedule.js",
  "app/tennis-note-member-app/forms/tickets.js",
  "app/tennis-note-member-app/ui/common.js",
  "app/tennis-note-member-app/app.js",
  "app/shared/tennisnote-escape-html.js",
  "app/shared/tennisnote-app-common.js",
  "app/tennis-note-coach-app/settings.js",
  "app/tennis-note-coach-app/catalog.js",
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
  "app/tennis-note-coach-app/data/auth.js",
  "app/tennis-note-coach-app/data/sync.js",
  "app/tennis-note-coach-app/data/push.js",
  "app/tennis-note-coach-app/data/records.js",
  "app/tennis-note-coach-app/ui/sheet.js",
  "app/tennis-note-coach-app/ui/screens.js",
  "app/tennis-note-coach-app/actions/records.js",
  "app/tennis-note-coach-app/actions/schedule.js",
  "app/tennis-note-coach-app/actions/profile.js",
  "app/tennis-note-coach-app/actions/session.js",
  "app/tennis-note-coach-app/storage.js",
  "app/tennis-note-coach-app/domain/common.js",
  "app/tennis-note-coach-app/views/common.js",
  "app/tennis-note-coach-app/forms/coaches.js",
  "app/tennis-note-coach-app/forms/common.js",
  "app/tennis-note-coach-app/ui/common.js",
  "app/tennis-note-coach-app/app.js",
];

// 콜백에 인덱스를 함께 넘기는 배열 메서드들
const ITERATORS = "map|flatMap|filter|forEach|find|findIndex|findLast|some|every|sort|reduce|reduceRight";

test("이음매가 붙은 함수를 배열 메서드에 그대로 넘기지 않는다", () => {
  // 이음매 함수 이름을 모든 파일에서 모은다. 파일을 넘나들며 쓰이기 때문이다.
  const seamed = new Set();
  const sources = new Map();
  for (const relativePath of SOURCES) {
    const source = readFileSync(join(repoRoot, relativePath), "utf8");
    sources.set(relativePath, source);
    for (const match of source.matchAll(/^(?:async )?function ([A-Za-z0-9_]+)\s*\(([^)]*)\)/gm)) {
      if (/(?<![\w.$])all[A-Z][A-Za-z0-9_]*\s*=/.test(match[2])) seamed.add(match[1]);
    }
  }

  const problems = [];
  const pattern = new RegExp(`\\.(${ITERATORS})\\(\\s*([A-Za-z0-9_]+)\\s*\\)`, "g");
  for (const [relativePath, source] of sources) {
    for (const match of source.matchAll(pattern)) {
      if (!seamed.has(match[2])) continue;
      const line = source.slice(0, match.index).split("\n").length;
      problems.push(
        `${relativePath}:${line} — .${match[1]}(${match[2]}) 로 넘기면 인덱스가 이음매 매개변수 자리에 들어간다`,
      );
    }
  }

  assert.deepEqual(
    problems,
    [],
    `이음매 함수를 콜백으로 그대로 넘긴 곳:\n  ${problems.join("\n  ")}\n\n` +
      "화살표 함수로 감싸세요: .map((item) => fn(item))",
  );
});
