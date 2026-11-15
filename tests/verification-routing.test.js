import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import routing from "./helpers/verification-routing.cjs";

test("현재 정산 오류 검사는 현재 코드로 실행하며 모든 과거 검사도 정확히 한 번 분류한다", () => {
  const source = fs.readFileSync(new URL("r3-production-selected.test.js", import.meta.url), "utf8");
  const groups = routing.verifySelectedRouting(source);
  assert(groups.current.includes("manual adjustment read errors other than missing RPC never fall back to legacy state"));
  assert(groups.historical.includes("selected release official558 reconstructs exact13 and preserves product11 semantics plus native metadata"));
  assert.throws(() => routing.verifySelectedRouting(source + '\ntest("new unclassified case", () => {});'), /분류 필요/);
  assert.throws(() => routing.verifySelectedRouting(source + '\ntest("' + groups.current[0] + '", () => {});'), /중복/);
  assert.throws(() => routing.verifySelectedRouting(""), /누락/);
});
