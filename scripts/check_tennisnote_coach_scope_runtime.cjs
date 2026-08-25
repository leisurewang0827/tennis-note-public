const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const appPath = path.join(root, "app", "tennis-note-coach-app", "app.js");
const source = fs.readFileSync(appPath, "utf8");

function sourceBetween(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  assert.ok(start >= 0 && end > start, `missing source block: ${startMarker}`);
  return source.slice(start, end);
}

const runtimeSource = [
  sourceBetween("function requestCoachRoleId(request = {})", "function lessonBelongsToCurrentCoach(lesson = {})"),
  sourceBetween("function lessonBelongsToCurrentCoach(lesson = {})", "function ownTodayLessons()"),
  sourceBetween("function filterFullScheduleLessons(lessons, filter)", "function coachRequestTimelineState(lesson = {})"),
  sourceBetween("function formatScheduleMemberName(name)", "function memberFilter()"),
].join("\n");

const context = {
  state: { dataMode: "live", liveProfileId: "profile-park" },
  currentCoachRoleId: () => "park-role",
  currentCoachName: () => "박창준",
  canonicalCoachName: (value) => String(value || "").trim(),
  requestCoach: (request) => request.coach || "",
  coachLessonCardState: () => ({ needsFeedback: false }),
  escapeHtml: (value) => String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;"),
};
vm.runInNewContext(runtimeSource, context);

const own = { id: "own", coachRoleId: "park-role", type: "보강" };
const other = { id: "other", coachRoleId: "kang-role", type: "보강" };
const substitute = {
  id: "substitute",
  coachRoleId: "kang-role",
  substituteCoachRoleId: "park-role",
  isSubstitute: true,
  status: "확정",
};
const legacySubstitute = {
  id: "legacy-substitute",
  coachRoleId: "park-role",
  originalCoachRoleId: "kang-role",
  isSubstitute: true,
  status: "확정",
};

assert.deepEqual(
  Array.from(
    context.filterFullScheduleLessons([own, other, substitute, legacySubstitute], "mine"),
    (lesson) => lesson.id,
  ),
  ["own", "substitute", "legacy-substitute"],
  "own schedule must preserve exact owner and substitute role IDs",
);
assert.deepEqual(
  Array.from(
    context.filterFullScheduleLessons([own, other, substitute, legacySubstitute], "makeupChange"),
    (lesson) => lesson.id,
  ),
  ["own"],
  "change and makeup work must not expose another coach's lesson",
);
assert.equal(context.makeupRequestBelongsToCurrentCoach({ coachRoleId: "park-role" }), true);
assert.equal(context.makeupRequestBelongsToCurrentCoach({ coachRoleId: "kang-role" }), false);
assert.equal(context.makeupRequestBelongsToCurrentCoach({ coach: "박창준" }), false);
assert.equal(context.lessonBelongsToCurrentCoach({ coach: "박창준" }), false);

const memberMarkup = context.formatScheduleMemberName("성정은&장유정<script>");
assert.match(memberMarkup, /<span>성정은<\/span>/);
assert.match(memberMarkup, /<span>장유정&lt;script&gt;<\/span>/);
assert.doesNotMatch(memberMarkup, /<script>/);

const segmentSource = sourceBetween(
  "function renderCoachMobileSegment(day, segment, policy, scheduleLessons)",
  "function renderCoachMineEmptyState(policy, scheduleLessons)",
);
assert.match(segmentSource, /<strong>\$\{primaryMarkup\}<\/strong>/);
assert.doesNotMatch(segmentSource, /escapeHtml\(primaryLabel\)/);

console.log("PASS: coach scope and member-name runtime regression gate");
