import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, posix } from "node:path";
import { loadScripts } from "./helpers/browser-stub.js";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");

// index.html 이 부르는 스크립트를 그 순서대로 실제로 실행해 본다.
//
// 잡는 것: <script> 가 실행되는 순간 터지는 오류.
//   - 함수 밖 최상위 코드가 없는 이름을 참조 (실제로 났던 사고)
//   - 스크립트 순서가 틀려 아직 정의 안 된 함수를 호출
//
// 못 잡는 것: 함수 안에서만 일어나는 일. 그건 화면을 눌러봐야 안다.
// 이 검사는 브라우저 확인을 대신하지 못하고, 가장 흔한 실수만 걸러낸다.

// 각 앱이 직접 소유한 스크립트만 넣는다.
// app/shared/ 의 공용 모듈은 타이머·감시자를 걸어서 이 얕은 스텁으로는
// 끝까지 실행되지 않는다(무한 대기). 그쪽은 우리가 리팩터링하는 대상도
// 아니므로 범위 밖에 둔다. tennisnote-release.js 만 예외로 넣는데,
// app.js 최상위에서 버전을 읽기 때문이다.
const PAGES = [
  {
    label: "관리자",
    pathname: "/app/admin/",
    scripts: [
      "app/shared/tennisnote-release.js",
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
    ],
  },
  {
    label: "회원앱",
    pathname: "/app/tennis-note-member-app/",
    scripts: [
      "app/shared/tennisnote-release.js",
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
    ],
  },
  {
    label: "코치앱",
    pathname: "/app/tennis-note-coach-app/",
    scripts: [
      "app/shared/tennisnote-release.js",
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
    ],
  },
];

for (const page of PAGES) {
  test(`${page.label} — 스크립트가 로드 시점에 터지지 않는다`, () => {
    const sources = [];
    for (const scriptPath of page.scripts) {
      try {
        sources.push(readFileSync(join(repoRoot, scriptPath), "utf8"));
      } catch {
        // config.local.js 는 배포 때 생성된다. 없는 게 정상.
      }
    }
    assert.ok(sources.length > 0, `${page.label}: 읽어들인 스크립트가 없다`);
    loadScripts(sources, { pathname: page.pathname });
  });
}
