import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(join(root, path), "utf8");

test("코치 미처리 수는 서버 read-back을 권위로 사용하고 로컬 초안을 보존한다", () => {
  const schedule = source("app/tennis-note-coach-app/actions/schedule.js");
  const records = source("app/tennis-note-coach-app/domain/records.js");
  const home = source("app/tennis-note-coach-app/views/home.js");
  const helperStart = schedule.indexOf("function coachLessonLogHasUnsyncedDraft");
  const helperEnd = schedule.indexOf("function applyScheduleV2CoachWorkspace", helperStart);
  const pendingStart = records.indexOf("function ownPendingLessonLogs");
  const pendingEnd = records.indexOf("function completedFeedbackTimestamp", pendingStart);

  assert.ok(helperStart >= 0 && helperEnd > helperStart, "pending authority reconciliation helpers are missing");
  assert.ok(pendingStart >= 0 && pendingEnd > pendingStart, "pending counter helpers are missing");

  const context = vm.createContext({ Date, Set, Map, Array, Object, String, Number });
  vm.runInContext(`
    const coachPendingAuthorityVersion = 1;
    const state = {
      dataMode: "live",
      liveProfileId: "profile-a",
      coach: { coachRoleId: "role-a", branchId: "branch-a" },
      pendingLessonAuthority: null,
      pendingAuthorityCacheVersion: 0,
      lessonLogs: [],
      feedbackRequests: [],
    };
    function currentCoachRoleId() { return String(state.coach?.coachRoleId || ""); }
    function localDateKey(date = new Date()) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return year + "-" + month + "-" + day;
    }
    function recordBelongsToCurrentCoach() { return true; }
    function coachRecordProcessingState(log) { return { resolved: log.status === "확인 완료" }; }
    function lessonForRecord() { return null; }
    function lessonOutcomeWindowOpen() { return true; }
    function feedbackBelongsToCurrentCoach() { return true; }
    ${schedule.slice(helperStart, helperEnd)}
    ${records.slice(pendingStart, pendingEnd)}
    this.state = state;
    this.reconcile = reconcileCoachPendingCacheAfterServerReadback;
    this.pendingIds = coachAuthoritativePendingLessonIds;
    this.pendingLogs = ownPendingLessonLogs;
    this.pendingFeedback = ownPendingFeedbackRequests;
    this.deviceFeedback = deviceLocalPendingFeedbackRequests;
    this.deviceDrafts = ownDeviceOnlyPendingLessonDrafts;
  `, context);

  const today = new Date();
  const todayKey = [today.getFullYear(), String(today.getMonth() + 1).padStart(2, "0"), String(today.getDate()).padStart(2, "0")].join("-");
  const staleLogs = Array.from({ length: 9 }, (_, index) => ({
    id: `old-${index}`,
    serverLessonId: `stale-${index}`,
    status: "확인 대기",
  }));
  const deviceFeedback = Array.from({ length: 29 }, (_, index) => ({ id: `feedback-${index}`, status: "요청" }));
  const protectedDraft = {
    id: "draft-1",
    serverLessonId: "stale-draft",
    status: "동기화 실패",
    coachComment: "사용자가 작성한 미전송 초안",
    localCoachCommentDirty: true,
  };
  context.state.lessonLogs = [...staleLogs, protectedDraft];
  context.state.feedbackRequests = deviceFeedback;

  assert.equal(context.pendingLogs().length, 0);
  assert.equal(context.pendingFeedback().length, 0);

  const previous = new Map([
    ...staleLogs.map((log) => [log.serverLessonId, { lessonDate: todayKey }]),
    [protectedDraft.serverLessonId, { lessonDate: todayKey }],
  ]);
  assert.equal(context.reconcile({ from: "2020-01-01", to: "2099-12-31" }, [], previous), true);
  assert.equal(context.pendingIds().size, 0);
  assert.equal(context.pendingLogs().length, 0);
  assert.equal(context.state.lessonLogs.length, 1);
  assert.equal(context.state.lessonLogs[0].id, protectedDraft.id);
  assert.equal(context.deviceDrafts().length, 1);
  assert.equal(context.deviceFeedback().length, 29);

  const pendingLesson = {
    serverLessonId: "server-pending-1",
    serverStatus: "scheduled",
    lessonDate: todayKey,
    v2Permissions: { canProcess: true },
    v2Participants: [{ recordStatus: "draft" }],
  };
  context.state.lessonLogs.push({ id: "server-log", serverLessonId: pendingLesson.serverLessonId, status: "확인 대기" });
  assert.equal(context.reconcile({ from: "2020-01-01", to: "2099-12-31" }, [pendingLesson], new Map()), true);
  assert.deepEqual([...context.pendingIds()], [pendingLesson.serverLessonId]);
  assert.equal(context.pendingLogs().length, 1);

  context.state.pendingLessonAuthority = JSON.parse(JSON.stringify(context.state.pendingLessonAuthority));
  assert.equal(context.pendingLogs().length, 1);
  context.state.liveProfileId = "profile-b";
  assert.equal(context.pendingLogs().length, 0);

  assert.match(home, /서버 미처리 확인 중/);
  assert.doesNotMatch(records, /서버 미처리 수에는 포함하지 않습니다/);
});
