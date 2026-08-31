import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (path) => readFileSync(join(root, path), "utf8");

const memberHtml = read("app/tennis-note-member-app/index.html");
const memberActions = read("app/tennis-note-member-app/actions/requests.js");
const memberLessons = read("app/tennis-note-member-app/domain/lessons.js");
const memberSession = read("app/tennis-note-member-app/actions/session.js");
const coachSchedule = read("app/tennis-note-coach-app/domain/schedule-v2.js");
const coachRecords = read("app/tennis-note-coach-app/actions/records.js");
const coachView = read("app/tennis-note-coach-app/views/schedule.js");
const adminHtml = read("app/admin/index.html");
const adminSchedule = read("app/admin/schedule-v2-admin.js");

test("회원은 당일 불참 확인 시트와 다시 참석 동선을 사용한다", () => {
  assert.match(memberHtml, /id="sameDayAbsenceSheet"/);
  assert.match(memberHtml, /오늘 수업에 못 가시나요\?/);
  assert.match(memberActions, /tn_submit_member_same_day_absence/);
  assert.match(memberActions, /tn_restore_member_same_day_absence/);
  assert.match(memberActions, /target_operation_key/);
  assert.match(memberActions, /현재 상태에서는 다시 참석으로 바꿀 수 없습니다/);
});

test("회원 시간표는 서버의 exact request를 수업에 연결한다", () => {
  assert.match(memberSession, /memberSameDayAbsences/);
  assert.match(memberSession, /sameDayAbsenceByLessonId/);
  assert.match(memberLessons, /lesson\.sameDayAbsence/);
  assert.match(memberLessons, /불참 신청됨/);
  assert.match(memberLessons, /다시 참석할게요/);
});

test("코치는 담당 수업의 승인 대기와 불참 완료를 구분한다", () => {
  assert.match(coachSchedule, /memberSameDayAbsences/);
  assert.match(coachSchedule, /sameDayAbsence/);
  assert.match(coachRecords, /tn_review_member_same_day_absence/);
  assert.match(coachView, /data-review-same-day-absence="\$\{escapeHtml\(sameDayAbsence\.id\)\}"/);
  assert.match(coachView, /data-approve="true"/);
  assert.match(coachView, /승인 전 수업·횟수 유지/);
});

test("관리자는 초보자용 정책과 승인 동선을 같은 시간표 편집기에 둔다", () => {
  assert.match(adminHtml, /name="memberSameDayAbsenceEnabled"/);
  assert.match(adminHtml, /name="memberSameDayRestoreCutoffMinutes"/);
  assert.match(adminSchedule, /member_same_day_absence_enabled/);
  assert.match(adminSchedule, /member_same_day_absence_reason_mode/);
  assert.match(adminSchedule, /member_same_day_restore_cutoff_minutes/);
  assert.match(adminSchedule, /tn_review_member_same_day_absence/);
  assert.match(adminSchedule, /data-v2-review-same-day-absence/);
});

test("관리자 정책은 잘못된 다시 참석 마감값을 서버 전송 전에 막는다", () => {
  assert.match(adminSchedule, /memberSameDayRestoreCutoffMinutes < 0/);
  assert.match(adminSchedule, /memberSameDayRestoreCutoffMinutes > 1440/);
  assert.match(adminSchedule, /다시 참석 마감은 0~1440분으로 설정해 주세요/);
});
