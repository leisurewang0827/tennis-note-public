import { test } from "node:test";
import assert from "node:assert/strict";
import { loadSharedScript } from "./helpers/load-browser-script.js";

const { TennisNoteTicketState: TicketState } = loadSharedScript(
  "app/shared/tennisnote-ticket-state.js",
);

const TODAY = "2026-08-18";

// 이용권 상태는 회원이 예약할 수 있는지, 관리자 화면에 어떻게 뜨는지,
// 코치가 수업을 잡을 수 있는지를 전부 결정한다. 세 앱이 이 파일 하나를 공유한다.

test("상태 판정 — 기본", async (t) => {
  await t.test("이용권이 없으면 none", () => {
    assert.equal(TicketState.derive(null, TODAY), "none");
  });

  await t.test("상태가 비어 있으면 사용 중으로 본다", () => {
    assert.equal(TicketState.derive({ remaining: 4 }, TODAY), "current");
  });

  await t.test("만료일이 지나면 expired", () => {
    assert.equal(TicketState.derive({ expiresOn: "2026-08-17", remaining: 4 }, TODAY), "expired");
  });

  await t.test("만료일 당일은 아직 만료가 아니다", () => {
    assert.equal(TicketState.derive({ expiresOn: TODAY, remaining: 4 }, TODAY), "current");
  });

  await t.test("잔여 0회면 exhausted", () => {
    assert.equal(TicketState.derive({ remaining: 0 }, TODAY), "exhausted");
  });

  await t.test("시작일이 미래면 upcoming", () => {
    assert.equal(TicketState.derive({ startsOn: "2026-09-01", remaining: 4 }, TODAY), "upcoming");
  });

  await t.test("일시정지는 paused", () => {
    assert.equal(TicketState.derive({ status: "paused", remaining: 4 }, TODAY), "paused");
  });
});

// 여러 조건이 겹칠 때 무엇이 이기는지. 이 순서가 바뀌면
// 환불한 이용권이 "만료"로 보이는 식의 사고가 난다.
test("상태 판정 — 우선순위", async (t) => {
  await t.test("환불이 만료보다 우선한다", () => {
    const ticket = { status: "refunded", expiresOn: "2026-01-01", remaining: 0 };
    assert.equal(TicketState.derive(ticket, TODAY), "refunded");
  });

  await t.test("결제 취소가 소진보다 우선한다", () => {
    assert.equal(TicketState.derive({ status: "cancelled", remaining: 0 }, TODAY), "cancelled");
  });

  await t.test("결제 대기가 시작 예정보다 우선한다", () => {
    const ticket = { status: "pending_payment", startsOn: "2026-09-01" };
    assert.equal(TicketState.derive(ticket, TODAY), "pending_payment");
  });

  await t.test("만료가 소진보다 우선한다", () => {
    const ticket = { expiresOn: "2026-01-01", remaining: 0 };
    assert.equal(TicketState.derive(ticket, TODAY), "expired");
  });

  await t.test("소진이 시작 예정보다 우선한다", () => {
    const ticket = { remaining: 0, startsOn: "2026-09-01" };
    assert.equal(TicketState.derive(ticket, TODAY), "exhausted");
  });

  await t.test("시작 예정이 일시정지보다 우선한다", () => {
    const ticket = { status: "paused", startsOn: "2026-09-01", remaining: 4 };
    assert.equal(TicketState.derive(ticket, TODAY), "upcoming");
  });
});

// 서버는 snake_case, 클라이언트는 camelCase 를 쓴다.
// 별칭 처리가 깨지면 이용권이 통째로 "사용 중"으로 잘못 뜬다.
test("서버 필드명(snake_case)도 똑같이 읽는다", async (t) => {
  await t.test("expires_on", () => {
    assert.equal(TicketState.derive({ expires_on: "2026-08-17", remaining: 4 }, TODAY), "expired");
  });

  await t.test("remaining_sessions", () => {
    assert.equal(TicketState.derive({ remaining_sessions: 0 }, TODAY), "exhausted");
  });

  await t.test("starts_on", () => {
    assert.equal(TicketState.derive({ starts_on: "2026-09-01", remaining: 4 }, TODAY), "upcoming");
  });

  await t.test("camelCase 와 결과가 같다", () => {
    const snake = TicketState.derive({ expires_on: "2026-08-17", remaining_sessions: 2 }, TODAY);
    const camel = TicketState.derive({ expiresOn: "2026-08-17", remaining: 2 }, TODAY);
    assert.equal(snake, camel);
  });
});

test("split — 회원 화면의 세 묶음", () => {
  const tickets = [
    { id: "a", remaining: 4 },
    { id: "b", status: "paused", remaining: 4 },
    { id: "c", startsOn: "2026-09-01", remaining: 4 },
    { id: "d", status: "pending_payment" },
    { id: "e", expiresOn: "2026-01-01", remaining: 4 },
    { id: "f", remaining: 0 },
    { id: "g", status: "refunded" },
  ];
  const groups = TicketState.split(tickets, TODAY);

  assert.deepEqual(groups.current.map((t) => t.id), ["a", "b"]);
  assert.deepEqual(groups.upcoming.map((t) => t.id), ["c", "d"]);
  assert.deepEqual(groups.history.map((t) => t.id).sort(), ["e", "f", "g"]);

  const total = groups.current.length + groups.upcoming.length + groups.history.length;
  assert.equal(total, tickets.length, "이용권이 어느 묶음에도 안 들어가면 화면에서 사라진다");
});

test("sort — 사용 중인 것이 먼저, 같은 상태면 최신 시작일이 먼저", () => {
  const tickets = [
    { id: "expired", expiresOn: "2026-01-01" },
    { id: "old", remaining: 4, startsOn: "2026-01-01" },
    { id: "new", remaining: 4, startsOn: "2026-08-01" },
  ];
  assert.deepEqual(
    TicketState.sort(tickets, TODAY).map((t) => t.id),
    ["new", "old", "expired"],
  );
});

test("sort 와 split 은 원본 배열을 건드리지 않는다", () => {
  const tickets = [{ id: "a", remaining: 0 }, { id: "b", remaining: 4 }];
  const snapshot = tickets.map((t) => t.id);
  TicketState.sort(tickets, TODAY);
  TicketState.split(tickets, TODAY);
  assert.deepEqual(tickets.map((t) => t.id), snapshot);
});

test("label — 회원에게 보이는 문구", () => {
  assert.equal(TicketState.label({ remaining: 4 }, TODAY), "사용 중");
  assert.equal(TicketState.label({ remaining: 0 }, TODAY), "소진");
  assert.equal(TicketState.label({ expiresOn: "2026-01-01" }, TODAY), "만료");
  assert.equal(TicketState.label({ status: "refunded" }, TODAY), "환불 완료");
  assert.equal(TicketState.label({ status: "paused", remaining: 4 }, TODAY), "일시정지");
});

// ⚠ 현재 동작을 그대로 기록해둔 것이지, 이게 옳다는 뜻은 아니다.
//
// value() 가 없는 필드에 ""를 돌려주고 Number("") 는 0 이라서,
// remaining 이 없거나 null 이면 "잔여 0회"와 구분되지 않는다.
// 지금은 모든 조회 쿼리가 remaining_sessions 를 포함하므로 터지지 않지만,
// DB 컬럼이 NULL 인 행이 하나라도 있으면 그 회원은 이용권이 "소진"으로 보이고
// 예약을 못 하게 된다.
//
// 고칠 때 이 테스트를 반대로 뒤집으면 된다. TASKS.md "발견한 것" 참고.
test("[알려진 문제] remaining 이 없으면 소진으로 판정된다", () => {
  assert.equal(TicketState.derive({ status: "active" }, TODAY), "exhausted");
  assert.equal(TicketState.derive({ remaining: null }, TODAY), "exhausted");
  assert.equal(TicketState.derive({}, TODAY), "exhausted");

  // 반면 종료 상태는 remaining 을 보기 전에 판정되므로 영향을 받지 않는다.
  assert.equal(TicketState.derive({ status: "refunded" }, TODAY), "refunded");
});

test("localDateKey — 한국 시간 기준", async (t) => {
  await t.test("YYYY-MM-DD 형식", () => {
    assert.match(TicketState.localDateKey(), /^\d{4}-\d{2}-\d{2}$/);
  });

  await t.test("UTC 로 전날 밤이어도 한국은 다음 날로 센다", () => {
    // 2026-08-17T16:00:00Z = 한국시간 2026-08-18 01:00
    // 여기가 UTC 기준으로 계산되면 회원의 이용권이 하루 일찍 만료된다.
    assert.equal(TicketState.localDateKey(new Date("2026-08-17T16:00:00Z")), "2026-08-18");
  });

  await t.test("한국시간 자정 직전은 아직 같은 날", () => {
    // 2026-08-17T14:59:00Z = 한국시간 2026-08-17 23:59
    assert.equal(TicketState.localDateKey(new Date("2026-08-17T14:59:00Z")), "2026-08-17");
  });
});
