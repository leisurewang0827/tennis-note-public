import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isPrivate = fs.existsSync(path.join(root, "90-Dashboard/shared/tennisnote-ticket-state.js"));
const app = path.join(root, isPrivate ? "90-Dashboard" : "app");
const context = vm.createContext({ window: {}, Date, Intl });
vm.runInContext(fs.readFileSync(path.join(app, "shared/tennisnote-ticket-state.js"), "utf8"), context);
const TicketState = context.window.TennisNoteTicketState;
const TODAY = "2026-08-18";
const BASE = Object.freeze({ status: "active", startsOn: "2026-08-01", expiresOn: TODAY, remaining: 1 });
const cases = [
  ["종료일 당일", {}, "current", "usable", true],
  ["종료 다음날", { expiresOn: "2026-08-17" }, "expired", "date_expired", false],
  ["잔여 0", { remaining: 0 }, "exhausted", "uses_exhausted", false],
  ["잔여 음수", { remaining: -1 }, "exhausted", "uses_exhausted", false],
  ["null 추정 금지", { remaining: null, total: 8, used: 0 }, "unknown", "remaining_unknown", false],
  ["문자 잔여", { remaining: " 1 " }, "current", "usable", true],
  ["비숫자", { remaining: "NaN" }, "unknown", "remaining_unknown", false],
  ["빈 문자열", { remaining: "" }, "unknown", "remaining_unknown", false],
  ["공백", { remaining: " " }, "unknown", "remaining_unknown", false],
  ["boolean", { remaining: true }, "unknown", "remaining_unknown", false],
  ["미래", { startsOn: "2026-08-19", expiresOn: "2026-09-01" }, "upcoming", "upcoming", false],
  ["휴회", { status: "paused" }, "paused", "paused", false],
  ["휴회 지난기간", { status: "paused", expiresOn: "2026-08-17" }, "expired", "date_expired", false],
  ["미래 잔여0", { startsOn: "2026-08-19", remaining: 0 }, "exhausted", "uses_exhausted", false],
  ["삭제", { status: "voided", remaining: 0 }, "voided", "voided", false],
  ["환불", { status: "refunded", expiresOn: "2026-08-17" }, "refunded", "refunded", false],
  ["취소", { status: "canceled", remaining: 0 }, "cancelled", "cancelled", false],
  ["입금대기", { status: "pending_payment", remaining: 0 }, "pending_payment", "pending_payment", false],
  ["환불보류", { refundHoldId: "synthetic-hold" }, "held", "held", false],
  ["기존 만료", { status: "expired" }, "expired", "explicit_expired", false],
  ["불명 상태", { status: "unexpected" }, "unknown", "status_unknown", false],
  ["날짜 누락", { expiresOn: "" }, "unknown", "date_unknown", false],
  ["날짜 오류", { startsOn: "2026-02-30" }, "unknown", "date_unknown", false],
];
for (const [name, overrides, state, reason, canUse] of cases) {
  test(name, () => {
    const ticket = Object.freeze({ ...BASE, ...overrides });
    const before = JSON.stringify(ticket);
    const actual = TicketState.classify(ticket, TODAY);
    assert.equal(actual.state, state);
    assert.equal(actual.reason, reason);
    assert.equal(actual.canUse, canUse);
    assert.equal(TicketState.derive(ticket, TODAY), state);
    assert.equal(JSON.stringify(ticket), before, "원본 횟수/상태 변경 0");
    if (["date_expired", "uses_exhausted"].includes(reason)) assert.equal(TicketState.label(ticket, TODAY), "회원권 만료");
  });
}
test("별칭·누락·KST 자정·포괄 기간", () => {
  for (const ticket of [
    { starts_on: BASE.startsOn, expires_on: TODAY, remaining_sessions: 1 },
    { starts: BASE.startsOn, expires: TODAY, remainingSessions: 1 },
    { start_date: BASE.startsOn, end_date: TODAY, remaining: 1 },
  ]) assert.equal(TicketState.classify(ticket, TODAY).canUse, true);
  for (const remaining of [undefined, null, Infinity, [], {}]) {
    assert.equal(TicketState.classify({ ...BASE, remaining, remainingSessions: 8 }, TODAY).reason, "remaining_unknown");
  }
  assert.equal(TicketState.classify({ total: 8, used: 0 }, TODAY).reason, "remaining_unknown");
  assert.equal(TicketState.derive(null, TODAY), "none");
  assert.equal(TicketState.classify(BASE, "bad-date").canUse, false);
  assert.equal(TicketState.localDateKey(new Date("2026-08-18T14:59:59Z")), TODAY);
  assert.equal(TicketState.localDateKey(new Date("2026-08-18T15:00:00Z")), "2026-08-19");
  assert.equal(TicketState.classify(BASE, TicketState.localDateKey(new Date("2026-08-18T15:00:00Z"))).reason, "date_expired");
});
test("split/sort 원본 보존, 휴회 보유 != 일반 신규 사용", () => {
  const tickets = [{ ...BASE, id: "current" }, { ...BASE, id: "paused", status: "paused" }, { ...BASE, id: "future", startsOn: "2026-08-19", expiresOn: "2026-09-01" }, { ...BASE, id: "history", remaining: 0 }];
  const before = JSON.stringify(tickets);
  const groups = TicketState.split(tickets, TODAY);
  assert.deepEqual(Array.from(groups.current, t => t.id), ["current", "paused"]);
  assert.deepEqual(Array.from(groups.upcoming, t => t.id), ["future"]);
  assert.deepEqual(Array.from(groups.history, t => t.id), ["history"]);
  assert.equal(TicketState.classify(tickets[1], TODAY).canUse, false);
  assert.equal(JSON.stringify(tickets), before);
});

function extract(relativePath, name) {
  const text = fs.readFileSync(path.join(app, relativePath), "utf8");
  const match = text.match(new RegExp("^function " + name + "\\([\\s\\S]*?^}", "m"));
  assert.ok(match, name + " 실제 entry 함수 누락");
  return match[0];
}
const memberFile = "tennis-note-member-app/" + (isPrivate ? "app.js" : "domain/tickets.js");
const coachFile = "tennis-note-coach-app/" + (isPrivate ? "app.js" : "domain/members.js");
const adminFile = isPrivate ? "tennis-note-prototype/app.js" : "admin/domain/tickets.js";
const scheduleFile = isPrivate ? adminFile : "admin/forms/schedule.js";
const roles = vm.createContext({
  window: context.window, Date, Intl, state: { liveTickets: [] },
  localDateKey: () => TODAY, adminLocalDateKey: () => TODAY,
  membershipProductForTicket: () => ({ productKind: "regular" }),
});
for (const [file, names] of [
  [memberFile, ["isActiveRegularLiveTicket", "isActiveCouponLiveTicket", "isPausedRegularLiveTicket", "memberHasActiveLiveTicket", "liveTicketStatusInfo"]],
  [coachFile, ["coachRosterTicketState"]],
  [adminFile, ["managementReportTicketIsActive", "isRegularScheduleTicket", "isActiveCouponTicket"]],
  [scheduleFile, ["ticketCanBeUsedOnLessonDate"]],
]) for (const name of names) vm.runInContext(extract(file, name), roles);

test("실제 member/coach/admin helper parity 및 helper 누락 fail-closed", () => {
  for (const [name, overrides, state, reason, canUse] of cases) {
    const ticket = Object.freeze({ ...BASE, productKind: "regular", ...overrides });
    const before = JSON.stringify(ticket);
    roles.state.liveTickets = [ticket];
    for (const fn of ["isActiveRegularLiveTicket", "managementReportTicketIsActive", "isRegularScheduleTicket", "ticketCanBeUsedOnLessonDate"]) {
      assert.equal(roles[fn](ticket, TODAY), canUse, fn + ": " + name);
    }
    assert.equal(roles.memberHasActiveLiveTicket(), canUse, "member active: " + name);
    assert.equal(["active", "expiring"].includes(roles.coachRosterTicketState(ticket, TODAY)), canUse, "coach: " + name);
    if (["date_expired", "uses_exhausted"].includes(reason)) assert.equal(roles.liveTicketStatusInfo(ticket, TODAY).label, "회원권 만료");
    assert.equal(JSON.stringify(ticket), before);
  }
  assert.equal(roles.isPausedRegularLiveTicket({ ...BASE, productKind: "regular", status: "paused" }, TODAY), true);
  assert.equal(roles.isActiveCouponLiveTicket({ ...BASE, productKind: "coupon" }, TODAY), true);
  assert.equal(roles.isActiveCouponTicket({ ...BASE, productKind: "coupon" }, TODAY), true);
  const saved = roles.window.TennisNoteTicketState;
  roles.window.TennisNoteTicketState = undefined;
  assert.equal(roles.isActiveRegularLiveTicket(BASE, TODAY), false);
  assert.equal(roles.managementReportTicketIsActive(BASE, TODAY), false);
  assert.equal(roles.ticketCanBeUsedOnLessonDate(BASE, TODAY), false);
  roles.window.TennisNoteTicketState = saved;
});
