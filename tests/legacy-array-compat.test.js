import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = (path) => readFileSync(join(root, path), "utf8");

function productionJavaScriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return productionJavaScriptFiles(path);
    return entry.isFile() && entry.name.endsWith(".js") ? [path] : [];
  });
}

function functionSource(relativePath, name) {
  const body = source(relativePath);
  const start = body.indexOf(`function ${name}(`);
  const next = body.indexOf("\nfunction ", start + 1);
  assert.notEqual(start, -1, `${name} 시작을 찾지 못했습니다.`);
  return body.slice(start, next === -1 ? body.length : next);
}

function legacyContext(values = {}) {
  const context = { ...values };
  vm.createContext(context);
  vm.runInContext("Array.prototype.at = undefined;", context);
  return context;
}

test("배포되는 JavaScript는 Array.prototype.at에 의존하지 않는다", () => {
  const offenders = productionJavaScriptFiles(join(root, "app"))
    .filter((path) => /\.at\s*\(/u.test(readFileSync(path, "utf8")))
    .map((path) => path.slice(root.length + 1));
  assert.deepEqual(offenders, []);
});

test("Array.prototype.at이 없어도 회원 일정 날짜와 주간 묶음을 계산한다", () => {
  const context = legacyContext({
    purchaseFlowSourceTicket: () => ({ expiresOn: "2026-09-19" }),
    purchaseFlowState: () => ({ purchasePurpose: "renew_same" }),
    localDateKey: (value) => {
      if (!value) return "2026-09-17";
      return value.toISOString().slice(0, 10);
    },
    memberBreakRuleForSlot: () => null,
    isMemberCoachWorking: () => true,
  });
  vm.runInContext(functionSource("app/tennis-note-member-app/domain/purchase.js", "purchaseEffectiveStartDate"), context);
  vm.runInContext(functionSource("app/tennis-note-member-app/domain/schedule.js", "memberDesktopScheduleBackgroundRuns"), context);

  assert.equal(context.purchaseEffectiveStartDate(), "2026-09-20");
  assert.deepEqual(
    JSON.parse(JSON.stringify(context.memberDesktopScheduleBackgroundRuns({}, "월", {}, ["09:00", "09:10", "09:20"]))),
    [{ state: "base", label: "", startIndex: 0, span: 3 }],
  );
});

test("Array.prototype.at이 없어도 운동일지 주간 범위를 계산한다", () => {
  const context = legacyContext({ normalizeJournalNavigationDate: (value) => String(value || "") });
  vm.runInContext(functionSource("app/tennis-note-member-app/domain/journal.js", "journalWeekRangeLabel"), context);
  assert.equal(
    context.journalWeekRangeLabel(["2026-09-14", "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-19", "2026-09-20"]),
    "2026년 9월 14일~20일",
  );
  assert.equal(context.journalWeekRangeLabel([]), "");
});
