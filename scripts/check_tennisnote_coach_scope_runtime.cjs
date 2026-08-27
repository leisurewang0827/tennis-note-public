const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const coachRoot = path.join(root, "app", "tennis-note-coach-app");

// 저쪽(origin/main)에서 온 검사다. 원본은 coach-app/app.js 안에서 함수 사이를
// 문자열로 잘라냈는데, 우리는 그 함수들을 domain/ 으로 옮겨서 그대로는 못 쓴다.
// 자르는 방식만 "파일을 뒤져 함수 하나를 꺼낸다" 로 바꿨고, 아래 단언은
// 저쪽 것 그대로다. 저쪽이 단언을 고치면 여기도 같이 고쳐야 한다.
function coachSources() {
  const out = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith(".js") && entry.name !== "schedule-v2-admin.js") out.push(full);
    }
  };
  walk(coachRoot);
  return out.sort();
}

const SOURCES = coachSources().map((file) => ({ file, lines: fs.readFileSync(file, "utf8").split("\n") }));

/** 함수 하나를 이름으로 찾아 본문째 꺼낸다. 함수 끝은 열 0 의 `}` 로 찾는다. */
function functionSource(name) {
  const head = new RegExp(`^(?:async\\s+)?function ${name}\\s*\\(`);
  for (const { lines } of SOURCES) {
    for (let i = 0; i < lines.length; i += 1) {
      if (!head.test(lines[i])) continue;
      let end = i + 1;
      while (end < lines.length && lines[end] !== "}") end += 1;
      return lines.slice(i, end + 1).join("\n");
    }
  }
  assert.fail(`missing function: ${name} (app/tennis-note-coach-app 어디에도 없습니다)`);
}

const runtimeSource = [
  "requestCoachRoleId",
  "makeupRequestBelongsToCurrentCoach",
  "lessonBelongsToCurrentCoach",
  "lessonAssignedToCurrentCoachForTasks",
  "filterFullScheduleLessons",
  // 1.0.405 에서 저쪽이 추가한 조각. normalize 가 decode 를 부르므로 둘 다 싣는다.
  "decodeCoachScheduleMemberEntities",
  "normalizeCoachScheduleMemberName",
  "formatScheduleMemberName",
].map(functionSource).join("\n");

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

const segmentSource = functionSource("renderCoachMobileSegment");
assert.match(segmentSource, /<strong>\$\{primaryMarkup\}<\/strong>/);
assert.doesNotMatch(segmentSource, /escapeHtml\(primaryLabel\)/);

console.log("PASS: coach scope and member-name runtime regression gate");
