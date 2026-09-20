import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const reporter = readFileSync(join(root, "app/shared/tennisnote-issue-reporter.js"), "utf8");

test("피드백 상태·우선순위 저장은 기존 관리자 메모를 보존한다", () => {
  assert.match(reporter, /const currentReport = adminReportState\.rows\.find/);
  assert.match(reporter, /target_admin_note: String\(currentReport\.admin_note \|\| ""\)/);
  assert.doesNotMatch(reporter, /target_admin_note:\s*""/);
});

test("목록이 stale이면 다른 피드백으로 대체하지 않고 저장을 중단한다", () => {
  assert.match(reporter, /String\(report\.id \|\| ""\) === String\(row\.dataset\.reportId \|\| ""\)/);
  assert.match(reporter, /if \(!currentReport\) throw new Error\("피드백 최신 정보를 다시 불러온 뒤 저장해 주세요\."\)/);
});
