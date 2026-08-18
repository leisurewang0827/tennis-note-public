import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAdminDomain } from "./helpers/load-admin-domain.js";

const T = loadAdminDomain(
  "app/admin/domain/values.js",
  "app/admin/domain/lessons.js",
  "app/admin/domain/tickets.js",
);

// ⚠ 지금 이렇게 동작한다를 고정한 것이다. app.js 에서 본문 그대로 옮겼으므로
// 여기가 깨지면 옮기다 뭔가 바뀐 것이다.
//
// allLiveData 이음매가 있는 함수는 인자를 반드시 넘겨야 한다.
// 기본값이 참조하는 전역(adminLiveDataState)은 app.js 에만 있어서
// 테스트 환경에는 없다. 넘기지 않으면 그 자리에서 터진다.

test("ticketUsageLabel — 총/소진/잔여 표기", () => {
  assert.equal(T.ticketUsageLabel({ total: 8, used: 3, remaining: 5 }), "총 8 / 소진 3 / 잔여 5");
  assert.equal(T.ticketUsageLabel({}), "총 0 / 소진 0 / 잔여 0", "값이 없으면 0 으로 본다");
  assert.equal(T.ticketUsageLabel(null), "총 0 / 소진 0 / 잔여 0");
  assert.equal(
    T.ticketUsageLabel({ total: -5, used: -1, remaining: -2 }),
    "총 0 / 소진 0 / 잔여 0",
    "음수는 0 으로 막는다",
  );
});

test("getTicketScheduleScope — 허용된 값만 통과", () => {
  assert.equal(T.getTicketScheduleScope({ scheduleScope: "weekend" }), "weekend");
  assert.equal(T.getTicketScheduleScope({ scheduleScope: "mixed" }), "mixed");
  assert.equal(T.getTicketScheduleScope({ scheduleScope: "매일" }), "weekday", "모르는 값은 평일로");
  assert.equal(T.getTicketScheduleScope({}), "weekday");
  assert.equal(T.getTicketScheduleScope(null), "weekday");
});

test("getTicketWeeklyUnitLimit — 주간 상한은 아래로 못 내려간다", () => {
  assert.ok(T.getTicketWeeklyUnitLimit({}) >= 1, "최소 1");
  assert.equal(
    T.getTicketWeeklyUnitLimit({ maxSessionsPerWeek: 3 }),
    3,
    "명시된 주간 상한을 쓴다",
  );
  assert.equal(
    T.getTicketWeeklyUnitLimit({ maxSessionsPerDay: 2 }),
    2,
    "주간 상한이 없으면 일일 상한을 쓴다",
  );
});

test("memberOwnsTicket — 서버 계정 id 로 판정", () => {
  const liveData = { users: [{ id: "u1", name: "김서준" }] };
  const member = { serverUserId: "u1", name: "김서준" };
  const ticket = { serverUserId: "u1" };

  assert.equal(T.memberOwnsTicket(ticket, member, liveData), true);
  assert.equal(T.memberOwnsTicket({ serverUserId: "u2" }, member, liveData), false);
  assert.equal(T.memberOwnsTicket(null, member, liveData), false);
  assert.equal(T.memberOwnsTicket(ticket, null, liveData), false);

  // 회원에게 서버 계정 id 가 없으면 이름으로 대조한다
  const nameOnly = { name: "김서준" };
  assert.equal(T.memberOwnsTicket(ticket, nameOnly, liveData), true);
  assert.equal(T.memberOwnsTicket(ticket, { name: "다른사람" }, liveData), false);
});

test("memberTicketOwnershipLabel — 본인권 / 파트너권", () => {
  const liveData = { users: [{ id: "u1", name: "김서준" }, { id: "u2", name: "이하린" }] };
  const member = { serverUserId: "u1", name: "김서준" };

  assert.equal(T.memberTicketOwnershipLabel({ serverUserId: "u1" }, member, liveData), "본인권");
  assert.equal(
    T.memberTicketOwnershipLabel({ serverUserId: "u2" }, member, liveData),
    "파트너권 · 이하린",
    "다른 사람 이용권이면 주인 이름을 붙인다",
  );
  assert.equal(
    T.memberTicketOwnershipLabel({ serverUserId: "u9" }, member, liveData),
    "파트너권",
    "주인을 못 찾으면 이름 없이",
  );
  assert.equal(T.memberTicketOwnershipLabel({}, member, liveData), "", "소유자가 없으면 빈 문자열");
});

test("이음매 함수는 인자를 안 넘기면 터진다", () => {
  // 기본값이 참조하는 adminLiveDataState 가 테스트 환경에 없기 때문이다.
  // 이 동작 자체를 기록해 둔다. 나중에 기본값을 지우면 이 테스트도 지운다.
  assert.throws(
    () => T.memberOwnsTicket({ serverUserId: "u1" }, { name: "김서준" }),
    ReferenceError,
  );
});
