// 비공개 권위 블록을 그대로 이식했는지 검사한다. 합성 자료만 사용한다.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
const sha = text => crypto.createHash("sha256").update(text).digest("hex");
const manifest = JSON.parse(read("tests/fixtures/coach-round-source-parity.json"));
const shared = read("app/shared/tennisnote-ui-language.js");
const sources = manifest.files.map(row => read(row.path)).join("\n");
const bootstrap = `var state = { liveLessons: [], liveLessonsLoaded: true }; var workspace = { tickets: [] };
function scheduleV2CoachWorkspace() { return workspace; }
function coachDisplayLessons(rows) { return window.TennisNoteUiLanguage.mergeLessonDisplaySegments(rows); }
function coachTicketSessionSnapshot(row) { return window.TennisNoteUiLanguage.ticketSessionSnapshot(row); }`;
function runCases() {
  const checks = [];
  const check = (name, actual, expected) => {
    if (JSON.stringify(actual) !== JSON.stringify(expected)) throw Error(name + ": " + JSON.stringify(actual));
    checks.push(name);
  };
  const copy = (value) => JSON.parse(JSON.stringify(value));
  const participant = (ticketId = "ticket-a", userId = "member-a", used = 0, total = 5) => ({
    ticketId, userId, recordStatus: "draft", totalSessions: total, usedSessions: used, remainingSessions: total - used,
  });
  const rows = (used = 0, total = 5, ticketId = "ticket-a", userId = "member-a") => Array.from({ length: total - used }, (_, index) => ({
    id: `${ticketId}-row-${index}`, serverLessonId: `${ticketId}-logical-${index}`, serverRevision: 1,
    lessonDate: `2099-01-${String(index + 1).padStart(2, "0")}`, time: "06:40", durationMinutes: 20,
    coachRoleId: "coach-a", serverStatus: "scheduled", lessonSource: "regular", ticketId,
    ticketLessonMinutes: 20, totalSessions: total, usedSessions: used, remaining: total - used,
    memberUserIds: [userId], v2Participants: [participant(ticketId, userId, used, total)],
  }));
  const set = (lessons, tickets = []) => { state.liveLessons = lessons; state.liveLessonsLoaded = true; workspace = { tickets }; };
  const labels = () => state.liveLessons.map(coachScheduleRoundLabel);
  let data = rows(); set(data);
  const baseline = JSON.stringify(data);
  check("five-future", labels(), ["1/5회차", "2/5회차", "3/5회차", "4/5회차", "5/5회차"]);
  check("record-known-exact", data.map((row) => coachRecordLessonMeta({ serverLessonId: row.serverLessonId }).round), labels());
  check("display-only-immutable", JSON.stringify(data), baseline);
  set(rows(2)); check("used-two", labels(), ["3/5회차", "4/5회차", "5/5회차"]);
  set(rows().reverse()); check("stable-order", labels(), ["5/5회차", "4/5회차", "3/5회차", "2/5회차", "1/5회차"]);
  set(rows().slice(2)); check("partial-week-no-fabrication", labels(), ["", "", ""]);
  check("record-partial-explicit-context", state.liveLessons.map((row) => coachRecordLessonMeta({ serverLessonId: row.serverLessonId }).round), ["회차 확인 필요", "회차 확인 필요", "회차 확인 필요"]);
  check("record-missing-exact-no-other-lesson", coachRecordLessonMeta({ serverLessonId: "missing-exact-lesson" }).round, "회차 확인 필요");
  set(rows()); state.liveLessonsLoaded = false; check("loading-no-round", labels(), ["", "", "", "", ""]);
  data = rows(); const cancelled = { ...copy(data[0]), id: "old-cancelled", serverLessonId: "old-cancelled", serverStatus: "cancelled" };
  set([...data, cancelled]); check("cancelled-excluded", labels().slice(0, 5), ["1/5회차", "2/5회차", "3/5회차", "4/5회차", "5/5회차"]);
  check("cancelled-no-live-fallback", coachScheduleRoundLabel(cancelled), "기록 당시 회차 미확정");
  data = rows(); data[2].serverStatus = "pending_change"; set(data); check("pending-change-hold", labels(), ["", "", "", "", ""]);
  data = rows(); data[1].v2Participants[0].usedSessions = 1; set(data); check("inconsistent-revision-counts", labels(), ["", "", "", "", ""]);
  data = rows(); data.push(copy(data[0])); set(data); check("duplicate-logical-hold", labels().every((x) => x === ""), true);
  data = rows(); data[0].v2Participants.push(copy(data[0].v2Participants[0])); set(data); check("duplicate-participant-hold", labels().every((x) => x === ""), true);
  data = rows(); set(data); const stale = { ...data[0], serverRevision: 0 }; check("stale-target-hold", coachScheduleRoundLabel(stale), "");
  set(data, [{ id: "ticket-a", ...participant(), usedSessions: 1, lessonMinutes: 20 }]); check("workspace-ticket-drift", labels().every((x) => x === ""), true);
  data = [...rows(), ...rows(2, 5, "ticket-b")]; set(data); check("same-person-other-ticket", labels(), ["1/5회차", "2/5회차", "3/5회차", "4/5회차", "5/5회차", "3/5회차", "4/5회차", "5/5회차"]);
  data = rows(0, 3); data.forEach((row) => row.v2Participants.push(participant("ticket-b", "member-b", 2, 5)));
  set(data, [{ id: "ticket-a", ...participant("ticket-a", "member-a", 0, 3), lessonMinutes: 20 }, { id: "ticket-b", ...participant("ticket-b", "member-b", 2, 5), lessonMinutes: 20 }]);
  check("group-independent-tickets", labels(), ["회원별 1/3회차 · 3/5회차", "회원별 2/3회차 · 4/5회차", "회원별 3/3회차 · 5/5회차"]);
  check("record-group-not-primary-ticket", coachRecordLessonMeta({ serverLessonId: data[0].serverLessonId }).round, "회원별 1/3회차 · 3/5회차");
  data = rows(0, 2); data[1].lessonDate = data[0].lessonDate; data[1].time = "07:00"; set(data.reverse());
  check("same-date-time-order", labels(), ["2/2회차", "1/2회차"]);
  data[0].time = "06:40"; check("overlap-no-tie-guess", labels(), ["", ""]);
  data = rows(0, 1); data[0].ticketLessonMinutes = 40;
  const second = { ...copy(data[0]), id: "segment-b", time: "07:00" };
  set([data[0], second]); check("20-plus-20-single-logical", labels(), ["1/1회차", "1/1회차"]);
  check("merged-card-single-logical", coachScheduleRoundLabel(coachDisplayLessons(state.liveLessons)[0]), "1/1회차");
  second.serverLessonId = "different-logical"; check("adjacent-not-same-logical", labels(), ["", ""]);
  data = rows(0, 2); data[0].durationMinutes = 40; set([data[0]]); check("multi-unit-range", labels(), ["1~2/2회차"]);
  data = rows(0, 1); data[0].durationMinutes = 40; data[0].ticketLessonMinutes = 40; set(data); check("40-minute-one-unit", labels(), ["1/1회차"]);
  data = rows(); data[0].v2Participants[0].userId = ""; set(data); check("missing-exact-member", coachScheduleRoundLabel(data[0]), "");
  data = rows(); data[0].v2Participants = []; set(data); check("no-legacy-name-inference", coachScheduleRoundLabel(data[0]), "");
  data = rows(); data[0].lessonSource = "makeup"; set(data); check("no-makeup-ticket-charge-guess", coachScheduleRoundLabel(data[0]), "");
  const final = rows()[0]; final.serverStatus = "completed"; final.v2Participants[0].recordStatus = "final";
  final.v2Participants[0].ticketSessionSnapshot = { version: 1, ticketId: "ticket-a", totalSessions: 5, usedBefore: 1, usedAfter: 2, remainingBefore: 4, remainingAfter: 3, participantDeductedSessions: 1, ticketDeductedSessions: 1 };
  final.v2Participants[0].usedSessions = 5; final.v2Participants[0].remainingSessions = 0; set([]);
  check("final-immutable-not-current-ticket", coachScheduleRoundLabel(final), "이번 수업 2/5회차");
  set([final]); check("record-final-immutable", coachRecordLessonMeta({ serverLessonId: final.serverLessonId }).round, "이번 수업 2/5회차");
  delete final.v2Participants[0].ticketSessionSnapshot; check("final-missing-snapshot", coachScheduleRoundLabel(final), "기록 당시 회차 미확정");
  check("record-final-not-pending-context", coachRecordLessonMeta({ serverLessonId: final.serverLessonId }).round, "기록 당시 회차 미확정");
  set(rows());
  return { passed: checks.length, labels: labels() };
}

test("코치 회차: private exact 블록·나머지 public source·실제 entry 보존", () => {
  assert.equal(manifest.privateSource, "5d717532864f57dccf04ab74b1192e9effe5eec7");
  assert.equal(manifest.files.length, 2);
  const entry = read("app/tennis-note-coach-app/index.html");
  const serviceWorker = read("app/tennis-note-coach-app/service-worker.js");
  for (const row of manifest.files) {
    let current = read(row.path);
    assert.equal(sha(current), row.candidateSha256);
    assert.equal(row.hunks.length, 1);
    for (const hunk of row.hunks) {
      assert.equal(current.split(hunk.after).length, 2);
      assert.equal(sha(hunk.after), row.authorityBlockSha256);
      current = current.replace(hunk.after, hunk.before);
    }
    const original = execFileSync("git", ["show", manifest.publicBase + ":" + row.path], { cwd: root, encoding: "utf8" }).replace(/\r\n/g, "\n");
    assert.equal(current, original);
    assert.equal(sha(current), row.baseSha256);
    const relative = "./" + row.path.split("tennis-note-coach-app/")[1];
    assert(entry.includes(relative + "?"));
    assert(serviceWorker.includes(relative + "?"));
  }
});
test("코치 회차: exact 회원권·그룹·20+20·완료 snapshot·불확실성 34사례", () => {
  const context = vm.createContext({ window: {} });
  vm.runInContext(shared + "\n" + bootstrap + "\n" + sources + "\n" + runCases.toString(), context);
  assert.equal(context.runCases().passed, 34);
});
if (process.env.TENNISNOTE_ROUND_BROWSER === "true") {
  test("코치 회차 modular Chromium/WebKit: 세로·가로·light/dark 16조합", async () => {
    const require = createRequire(import.meta.url);
    const { chromium, webkit } = require("playwright");
    for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]]) {
      const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
      const browser = await engine.launch({ headless: true, ...(name === "chromium" && fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
      try {
        const page = await browser.newPage();
        let requests = 0; const errors = [];
        await page.route("**/*", route => { requests++; return route.abort(); });
        page.on("pageerror", error => errors.push(error.message));
        await page.setContent('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body><main id="rounds"></main></body></html>');
        await page.addScriptTag({ content: shared + "\n" + bootstrap + "\n" + sources + "\n" + runCases.toString() });
        for (const [width, height] of [[390,844],[768,1024],[1366,900],[844,390]]) for (const colorScheme of ["light","dark"]) {
          await page.setViewportSize({width,height}); await page.emulateMedia({colorScheme});
          const result = await page.evaluate(() => {
            const result = runCases();
            document.getElementById("rounds").replaceChildren(...result.labels.map(text => { const p = document.createElement("p"); p.textContent = text; return p; }));
            return {passed: result.passed, overflow: document.documentElement.scrollWidth > innerWidth, count: document.querySelectorAll("#rounds p").length};
          });
          assert.equal(result.passed,34); assert.equal(result.overflow,false); assert.equal(result.count,5);
        }
        assert.equal(requests,0); assert.deepEqual(errors,[]);
        await page.close();
      } finally { await browser.close(); }
    }
  });
}
