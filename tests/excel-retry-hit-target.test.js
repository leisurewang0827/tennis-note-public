"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { createHash } = require("node:crypto");
const port = require("./fixtures/excel-retry-source-parity.json");
const read = p => fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
const hash = text => createHash("sha256").update(text).digest("hex");
test("엑셀 재시도 제품 두 파일은 승인된 원본 및 역변환 hash와 일치", () => {
  assert.equal(port.privateSource, "4238abf216250e429885174dda0011c18f2928dc");
  assert.equal(port.files.length, 3);
  for (const row of port.files) {
    let text = read(row.path);
    assert.equal(hash(text), row.candidateSha256);
    for (const hunk of [...row.hunks].reverse()) {
      assert.equal(text.split(hunk.after).length, 2);
      text = text.replace(hunk.after, hunk.before);
    }
    assert.equal(hash(text), row.baseSha256);
  }
});
test("실제 modular entry 회귀는 비공개 Chromium/WebKit 검사와 동일", () => {
  const text = read("scripts/check_tennisnote_single_sheet_preview_browser.cjs");
  const body = text.slice(text.indexOf("async function retryHitTargetRegression("), text.indexOf("// Exact production refresh sender + actual admin entry/Worker/transport/batch."));
  assert.equal(hash(body), port.retryRegressionSha256);
  assert.match(text, /if\(retryFixOnly\|\|refreshRaceOnly\)\{await remoteExecutionScenario\(browser,engine\);continue;\}/);
});

test("refresh helper/sender/actual-entry regression retain exact private source parity", () => {
  const common = read("app/admin/actions/common.js");
  const helper = common.slice(common.indexOf("// Local identity/scope fence only;"), common.indexOf("function singleSheetPreviewSnapshot()"));
  const start = common.indexOf("    const previousSingleSheetReadSnapshot = adminSingleSheetReadSnapshot;");
  const sender = common.slice(start, common.indexOf("    const usersById =", start));
  assert.equal(hash(helper), port.refreshSource.helperSha256);
  assert.equal(hash(sender), port.refreshSource.senderSha256);
  assert.match(common, /getAccessScope: adminLocalPreviewMode \? undefined : singleSheetPreviewAccessScope/);
  const browser = read("scripts/check_tennisnote_single_sheet_preview_browser.cjs");
  const regression = browser.slice(browser.indexOf("// Exact production refresh sender + actual admin entry/Worker/transport/batch."), browser.indexOf("const observationStart"));
  assert.equal(hash(regression), port.refreshSource.publicRegressionSha256);
  assert.equal(hash(regression.replace('"app/admin/actions/common.js"', '"tennis-note-prototype/app.js"')), port.refreshSource.regressionSha256);
  assert.match(read("scripts/verify.sh"), /TENNISNOTE_EXCEL_REFRESH_RACE_ONLY=1 node scripts\/check_tennisnote_single_sheet_preview_browser\.cjs/);
});
