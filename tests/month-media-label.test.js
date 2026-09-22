import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (name) => fs.readFileSync(path.join(root, name), "utf8").replace(/\r\n/g, "\n");
const extract = (source, name) => {
  const match = source.match(new RegExp("^(?:async )?function " + name + "\\([^]*?^}", "m"));
  assert.ok(match, name);
  return match[0];
};
const hash = (text) => crypto.createHash("sha256").update(text).digest("hex");
const coach = "app/tennis-note-coach-app/";
const member = "app/tennis-note-member-app/";

test("정산·첨부·표시명은 병합된 private 권위 함수 9개와 공용 자산이 exact 일치한다", () => {
  const manifest = JSON.parse(read("docs/month-media-label-source-parity-20260922.json"));
  assert.equal(manifest.privateMainSha, "5b82fe62186bb7288d367a90f41f0579978d54e6");
  assert.equal(manifest.functions.length, 9);
  for (const item of manifest.functions) {
    assert.equal(hash(extract(read(item.publicModule), item.function)), item.sha256, item.function);
  }
  for (const item of manifest.sharedFiles) assert.equal(hash(read(item.publicModule)), item.sha256);
});

test("정산 월은 KST 현재 월과 실행 중 명시 선택을 구분한다", () => {
  let now = "2030-09-21T14:42:00Z";
  class Clock extends Date { constructor(...args) { super(...(args.length ? args : [now])); } }
  const context = vm.createContext({ Date: Clock, Intl, state: { settlementMonth: "2030-08", coach: { coachRoleId: "synthetic-coach" } } });
  vm.runInContext(read(coach + "domain/settlement.js"), context);
  const run = (text) => vm.runInContext(text, context);
  assert.equal(run("coachSettlementMonth()"), "2030-09");
  assert.equal(run('selectCoachSettlementMonth("2029-11")'), "2029-11");
  assert.equal(run("coachSettlementMonth()"), "2029-11");
  now = "2030-09-30T15:00:00Z";
  assert.equal(run("coachSettlementMonth()"), "2030-10");
  run('selectCoachSettlementMonth("2030-01")');
  now = "2030-12-31T15:00:00Z";
  assert.equal(run("coachSettlementMonth()"), "2031-01");
  assert.equal(run('selectCoachSettlementMonth("2031-13")'), "2031-01");
  run('selectCoachSettlementMonth("2030-01"); state.coach.coachRoleId="another-synthetic"');
  assert.equal(run("coachSettlementMonth()"), "2031-01");
  run('selectCoachSettlementMonth("2030-01"); coachSettlementSelection=null');
  assert.equal(run("coachSettlementMonth()"), "2031-01");
});

test("실제 modular entry는 월 선택·logout·error capture를 연결하고 기존 RPC를 유지한다", () => {
  assert.match(read(coach + "events/delegated.js"), /selectCoachSettlementMonth\(settlementMonth.value\)/);
  assert.match(extract(read(coach + "data/auth.js"), "logoutCoach"), /coachSettlementSelection = null/);
  assert.ok(read(coach + "data/sync.js").includes('target_month: `${coachSettlementMonth()}-01`'));
  assert.match(read(member + "events/delegated.js"), /document.addEventListener\("error", handleJournalMediaPreviewError, true\)/);
  for (const [surface, modules] of [[coach, ["domain/settlement.js", "data/auth.js", "events/delegated.js"]], [member, ["domain/journal.js", "views/journal.js", "ui/common.js", "events/delegated.js"]]]) {
    for (const module of modules) {
      assert.ok(read(surface + "index.html").includes("./" + module));
      assert.ok(read(surface + "service-worker.js").includes("./" + module));
    }
  }
});

test("legacy 첨부는 URL·권한·형식에 맞게 표시하며 오류 안내는 한 번만 추가한다", () => {
  const escapeHtml = (value) => String(value || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll('"', "&quot;");
  let notices = 0;
  const context = vm.createContext({ URL, window: { location: { href: "https://synthetic.invalid/" } }, escapeHtml,
    document: { createElement: () => ({ setAttribute() {}, textContent: "" }) } });
  vm.runInContext(read(member + "domain/journal.js") + "\n" + read(member + "views/journal.js") + "\n" + read(member + "ui/common.js"), context);
  const render = (items) => { context.items = items; return vm.runInContext("renderMediaPreview(items)", context); };
  assert.match(render([{ name: "synthetic.png", url: "" }]), /다시 첨부/);
  assert.match(render([{ name: "synthetic.png", url: "https://synthetic.invalid/photo" }]), /<img data-journal-media-preview/);
  assert.match(render([{ name: "synthetic.mov", type: "video/mp4", url: "blob:https://synthetic.invalid/video" }]), /controls playsinline/);
  assert.doesNotMatch(render([{ name: "synthetic.png", url: "javascript:alert(1)" }]), /<img/);
  assert.match(render([{ name: "synthetic.mp4", error: "첨부 접근 권한 없음" }]), /접근 권한 없음/);
  assert.equal(vm.runInContext('normalizeMediaItems({mediaNames:["synthetic.png"]})[0].url', context), "");
  context.media = { matches: () => true, dataset: {}, hidden: false, after: () => { notices += 1; } };
  vm.runInContext("handleJournalMediaPreviewError({target:media}); handleJournalMediaPreviewError({target:media})", context);
  assert.equal(notices, 1);
  assert.equal(context.media.hidden, true);
  assert.equal(context.media.dataset.previewFailed, "true");
});

test("관리자에서 정한 3개월 할인 표시명을 회원 화면에 그대로 보존한다", () => {
  const context = vm.createContext({ defaultMembershipProductFamilyLabels: { threeMonth: "3개월 (10% 할인)", fourWeek: "한달 (4주)" } });
  vm.runInContext(extract(read(member + "domain/products.js"), "normalizeMembershipProductFamilyLabels"), context);
  for (const label of ["3개월 (10% 할인)", "3 months discount", "3개월"]) {
    context.label = label;
    assert.equal(vm.runInContext("normalizeMembershipProductFamilyLabels({threeMonth:label}).threeMonth", context), label);
  }
  assert.equal(vm.runInContext("normalizeMembershipProductFamilyLabels({threeMonth:''}).threeMonth", context), "3개월 (10% 할인)");
  assert.match(read(member + "catalog.js") + read(member + "app.js"), /3개월 \(10% 할인\)/);
  assert.doesNotMatch(read("app/shared/tennisnote-product-catalog.js"), /4주권 3회 금액에서 10% 할인/);
});
