const test = require("node:test"), assert = require("node:assert/strict");
const { traceApi, failureRecord } = require("../scripts/tennisnote_single_sheet_await_diagnostic.cjs");
test("초기 helper 실패 기록: 원 오류/시간제한 보존, 본문 대신 단계/횟수만", async () => {
  const sentinel = "SYNTHETIC_PRIVATE_VALUE";
  const error = Object.assign(new Error(sentinel), { name: "TimeoutError", stack: `TimeoutError: ${sentinel}\n at call (C:/private/tennisnote_single_sheet_initial_ui_cases.cjs:42:8)` });
  const steps = []; let passedOptions, calls = 0;
  const target = { locator() { return this; }, waitFor(options) { calls++; passedOptions = options; return Promise.reject(error); } };
  const traced = traceApi(target, step => steps.push(step));
  const options = { timeout: 5000, state: "hidden" };
  await assert.rejects(traced.locator(sentinel).waitFor(options), caught => caught === error);
  assert.equal(passedOptions, options); assert.equal(calls, 1);
  const record = failureRecord(steps.at(-1), error, { fileCount: 1, busy: true, workerPosts: 1, generation: 3, historyPreview: true });
  assert.equal(record.step.method, "WAITFOR"); assert.equal(record.callsites[0].line, 42);
  assert.equal(record.errorName, "TimeoutError"); assert(!JSON.stringify(record).includes(sentinel));
  assert(!JSON.stringify(record).includes("C:/private"));
});
