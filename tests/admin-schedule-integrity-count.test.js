import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../app/admin/schedule-v2-admin.js", import.meta.url), "utf8");
const preview = source.match(/  async function runScheduleV2MemberIntegrityPreview\(\) \{[\s\S]*?\n  \}/)?.[0];
assert.ok(preview, "시간표 무결성 미리보기 함수가 있어야 한다");

const row = (ticketId, createdCount, remainingUnassignedUnits = 0, conflictCount = 0) => ({
  ticketId, eligible: true, createdCount, remainingUnassignedUnits, conflictCount,
});
const ticket = (ticketId, branchId) => ({
  ticketId, userId: ticketId, branchId, futureLessonCount: 0, issueCodes: ["active_regular_ticket_without_future_lessons"],
});

async function verifyCount(items, rowsByBranch, expectedGroups) {
  const summary = {};
  const applyButton = {};
  const state = {};
  const elements = {
    "#scheduleV2IntegrityButton": {},
    "#scheduleV2IntegrityApplyButton": applyButton,
    "#scheduleV2IntegritySummary": summary,
    "#scheduleV2IntegrityList": {},
  };
  const calls = [];
  await runInNewContext(`${preview}\nrunScheduleV2MemberIntegrityPreview();`, {
    $: (selector) => elements[selector],
    state,
    console,
    groupedScheduleIntegrityItems: (entries) => entries,
    operationKey: () => "fixture-preview",
    scheduleIntegrityIssueLabel: () => "연결 오류",
    scheduleIntegrityRepairLabel: () => "미리보기",
    scheduleIntegrityMemberLabel: () => "합성 회원",
    escapeHtml: String,
    bridge: () => ({
      rpc: async (name, payload) => {
        calls.push({ name, payload });
        return name === "tn_admin_schedule_v2_member_integrity_preview"
          ? { items, affectedMemberCount: items.length, affectedTicketCount: items.length }
          : { results: rowsByBranch[payload.target_branch_id] };
      },
    }),
    currentIntegrityContext: () => ({ authorized: true, actorId: "synthetic", branchId: "a" }),
    matchesIntegrityContext: (value) => value?.branchId === "a",
  });
  const expected = expectedGroups.reduce((count, [, ids]) => count + ids.length, 0);
  assert.deepEqual(Array.from(state.integrityRepairGroups, ([branch, ids]) => [branch, Array.from(ids)]), expectedGroups);
  assert.equal(applyButton.disabled, expected === 0);
  assert.equal(applyButton.textContent, expected ? `확정 가능한 ${expected}권 일정 생성` : "확정 가능한 일정 없음");
  assert.equal(calls[0].name, "tn_admin_schedule_v2_member_integrity_preview");
  const selectedItems = items.filter((item) => item.branchId === "a");
  assert.equal(calls.length, 1 + (selectedItems.length ? 1 : 0));
  assert.ok(calls.slice(1).every(({ name, payload }) =>
    name === "tn_admin_reconcile_future_regular_schedules" && payload.target_dry_run === true));
  assert.equal(summary.textContent, selectedItems.length
    ? `확인 필요 ${selectedItems.length}명 · ${selectedItems.length}권 · 자동 생성 가능 ${expected}권`
    : "문제 없음");
}

test("선택 지점의 확정 가능 회원권만 요약과 버튼에 동일하게 표시한다", async () => {
  await verifyCount(
    [ticket("ready-a", "a"), ticket("partial", "a"), ticket("conflict", "a"),
      ticket("ready-b", "b"), ticket("zero", "b"), ticket("no-branch", null)],
    {
      a: [row("ready-a", 3), row("partial", 1, 1), row("conflict", 1, 0, 1), row("no-branch", 2)],
      b: [row("ready-b", 2), row("zero", 0), row("unknown", 2)],
    },
    [["a", ["ready-a"]]],
  );
});

test("일부 생성 계획이 있어도 확정할 수 없다면 0권과 비활성 버튼을 표시한다", async () => {
  await verifyCount([ticket("partial", "a")], { a: [row("partial", 1, 1)] }, []);
});

test("점검 대상이 없다면 문제 없음과 비활성 버튼을 유지한다", async () => {
  await verifyCount([], {}, []);
});
