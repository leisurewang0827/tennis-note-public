import { test } from "node:test";
import assert from "node:assert/strict";
import { loadAdminDomain } from "./helpers/load-admin-domain.js";

const C = loadAdminDomain(
  "app/admin/domain/values.js",
  "app/admin/domain/lessons.js",
  "app/admin/domain/tickets.js",
  "app/admin/domain/coaches.js",
);

// ⚠ 지금 이렇게 동작한다를 고정한 것이다. app.js 에서 본문 그대로 옮겼으므로
// 여기가 깨지면 옮기다 뭔가 바뀐 것이다.

test("coachApprovalLabel / Tone — 승인 상태 표시", async (t) => {
  await t.test("승인됨", () => {
    for (const status of ["approved", "active"]) {
      assert.equal(C.coachApprovalLabel({ approvalStatus: status }), "코치 승인 완료");
      assert.equal(C.coachApprovalTone({ approvalStatus: status }), "good");
    }
  });

  await t.test("중지됨", () => {
    for (const status of ["disabled", "inactive"]) {
      assert.equal(C.coachApprovalLabel({ approvalStatus: status }), "코치 사용 중지");
      assert.equal(C.coachApprovalTone({ approvalStatus: status }), "danger");
    }
  });

  await t.test("그 외는 전부 대기", () => {
    assert.equal(C.coachApprovalLabel({}), "코치 승인 대기");
    assert.equal(C.coachApprovalLabel({ approvalStatus: "모르는값" }), "코치 승인 대기");
    assert.equal(C.coachApprovalTone({}), "warn");
  });

  await t.test("approvalStatus 가 없으면 coachMode 를 본다", () => {
    assert.equal(C.coachApprovalLabel({ coachMode: "approved" }), "코치 승인 완료");
    assert.equal(C.coachApprovalTone({ coachMode: "disabled" }), "danger");
  });
});

test("coachModeLabel — 코치모드 사용 여부", () => {
  assert.equal(C.coachModeLabel({ coachMode: "approved" }), "사용 중");
  assert.equal(C.coachModeLabel({ coachMode: "disabled" }), "사용 중지");
  assert.equal(C.coachModeLabel({}), "등록 확인");
});

test("coachEmploymentLabel — 근무 상태", () => {
  assert.equal(C.coachEmploymentLabel({ employmentStatus: "archived" }), "보관");
  assert.equal(C.coachEmploymentLabel({ employmentStatus: "ended" }), "근무 종료");
  assert.equal(C.coachEmploymentLabel({}), "근무 중");
  assert.equal(C.coachEmploymentLabel({ employmentStatus: "active" }), "근무 중");
});

test("sameCoachRoleSet — 순서와 타입을 무시하고 비교", () => {
  assert.equal(C.sameCoachRoleSet(["a", "b"], ["b", "a"]), true, "순서는 상관없다");
  assert.equal(C.sameCoachRoleSet(["a"], ["a", "b"]), false, "개수가 다르면 다르다");
  assert.equal(C.sameCoachRoleSet([], []), true);
  assert.equal(C.sameCoachRoleSet(), true, "둘 다 없으면 같다");
  assert.equal(C.sameCoachRoleSet([1, 2], ["1", "2"]), true, "숫자와 문자열을 같게 본다");
});

test("coachBlockSignature — 근무 블록을 비교 가능한 문자열로", () => {
  const a = [{ days: ["월", "화"], start: "18:00", end: "21:00", label: "저녁" }];
  const b = [{ days: ["화", "월"], start: "18:00", end: "21:00", label: "저녁" }];
  assert.equal(C.coachBlockSignature(a), C.coachBlockSignature(b), "요일 순서가 달라도 같다");

  const different = [{ days: ["월", "화"], start: "18:00", end: "22:00", label: "저녁" }];
  assert.notEqual(C.coachBlockSignature(a), C.coachBlockSignature(different));
  assert.equal(C.coachBlockSignature([]), "");
  assert.equal(C.coachBlockSignature(), "");
});

test("breakRuleAppliesToCoach — 대상 코치가 없으면 전체 적용", () => {
  const allCoaches = [{ id: "c1", serverRoleId: "r1" }, { id: "c2", serverRoleId: "r2" }];

  assert.equal(
    C.breakRuleAppliesToCoach({}, "c1", allCoaches),
    true,
    "대상 지정이 없으면 모든 코치에게 적용",
  );
  assert.equal(
    C.breakRuleAppliesToCoach({ coachRoleIds: ["r1"] }, "", allCoaches),
    true,
    "코치를 안 넘기면 적용으로 본다",
  );
  assert.equal(C.breakRuleAppliesToCoach({ coachRoleIds: ["r1"] }, "c1", allCoaches), true);
  assert.equal(C.breakRuleAppliesToCoach({ coachRoleIds: ["r1"] }, "c2", allCoaches), false);
});
