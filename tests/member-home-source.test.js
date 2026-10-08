// 비공개 권위 source를 공개 실행 모듈로 투영한 계약. 실제 계정/DB 없음.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(import.meta.url);
const { names, bootstrap, runCases, runRefreshEventCases } = require("./fixtures/member-home-cases.cjs");
const { restorePhone } = require("./helpers/verified-profile-phone-port.cjs");
const read = file => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n");
const hash = text => crypto.createHash("sha256").update(text).digest("hex");
const manifest = JSON.parse(read("tests/fixtures/member-home-source-parity.json"));
const version = JSON.parse(read("app/release.json")).version;
const signinProjection = JSON.parse(read("tests/fixtures/development-signin-source-parity.json"));
// 승인된 로그인 증분만 exact 역변환하고 기존 홈 golden은 그대로 검사한다.
const restoreSignin = (file, text) => {
  const row = signinProjection.files.find(item => item.path === file);
  if (!row) return text;
  text = text.replaceAll(version, signinProjection.publicVersion);
  assert.equal(hash(text), row.candidateSha256, `signin candidate drift: ${file}`);
  for (const hunk of [...row.hunks].reverse()) {
    assert(hunk.after, `empty signin hunk: ${file}`);
    assert.equal(text.split(hunk.after).length, 2, `exact signin hunk: ${file}`);
    text = text.replace(hunk.after, () => hunk.before);
  }
  assert.equal(hash(text), row.baseSha256, `signin base drift: ${file}`);
  return text.replaceAll(signinProjection.publicVersion, version);
};
const normalized = (file, text) => restoreSignin(file, restorePhone(file, text)).replaceAll(version, manifest.publicVersion);
const extract = (source, name) => {
  const matches = [...source.matchAll(new RegExp(`^(?:async )?function ${name}\\([^\\n]*\\)[^{]*\\{[\\s\\S]*?^}`, "gm"))];
  assert.equal(matches.length, 1, `exact function ${name}`);
  return matches[0][0];
};
const modules = [...manifest.files.map(row => row.path), "app/tennis-note-member-app/domain/lessons.js", "app/tennis-note-member-app/views/common.js"];
const all = modules.map(read).join("\n");
const script = names.map(name => extract(all, name)).join("\n");

test("회원 홈: private source SHA, 9모듈 전체 preimage/parity, 실제 entry 등록", () => {
  assert.equal(manifest.privateSource, "860b53fa8d0cf303d4405f023e7dd10bc5c204c3");
  assert.equal(manifest.publicBase, "762d0c31f9d856ee7bb484463a9282919cdbea60");
  assert.equal(manifest.files.length, 9);
  const index = read("app/tennis-note-member-app/index.html");
  const sw = read("app/tennis-note-member-app/service-worker.js");
  for (const row of manifest.files) {
    let current = normalized(row.path, read(row.path));
    assert.equal(hash(current), row.candidateSha256, row.path);
    for (const hunk of [...row.hunks].reverse()) {
      assert.equal(current.split(hunk.after).length, 2, `exact hunk ${row.path}`);
      current = current.replace(hunk.after, () => hunk.before);
    }
    assert.equal(hash(current), row.baseSha256, `unrelated source preserved ${row.path}`);
    const short = row.path.replace("app/tennis-note-member-app/", "./");
    assert(index.includes(`${short}?`), `actual entry ${short}`);
    assert(sw.includes(`${short}?`) || sw.includes(`"${short}"`), `cache entry ${short}`);
  }
  for (const block of manifest.blocks) {
    assert.equal(hash(extract(normalized(block.path, read(block.path)), block.name)), block.publicSha256, block.name);
    if (block.adaptation === "none") assert.equal(block.privateSha256, block.publicSha256, block.name);
  }
});

test("회원 홈: 로그인 projection의 추가·중복·누락 drift는 golden 비교 전에 차단", () => {
  assert.equal(signinProjection.contract, "development-existing-sign-in/1");
  assert.equal(signinProjection.files.length, 4);
  for (const row of signinProjection.files) {
    const source = restorePhone(row.path, read(row.path)).replaceAll(version, signinProjection.publicVersion);
    const restored = restoreSignin(row.path, source).replaceAll(version, signinProjection.publicVersion);
    assert.equal(hash(restored), row.baseSha256, row.path);
    const after = row.hunks[0].after;
    assert.equal(source.split(after).length, 2, `mutation fixture ${row.path}`);
    for (const drift of [source + "\n", source.replace(after, () => after + after), source.replace(after, "")]) {
      assert.throws(() => restoreSignin(row.path, drift), /signin candidate drift/);
    }
  }
  const unrelated = "app/tennis-note-member-app/domain/lessons.js";
  assert.equal(restoreSignin(unrelated, read(unrelated)), read(unrelated));
});

test("회원 홈: public 원데이/권한/조회 계층과 홈 진입·로그아웃 계약 유지", () => {
  assert.equal((read("scripts/verify.sh").match(/^TENNISNOTE_HOME_BROWSER=true node --test --test-name-pattern=/gm) || []).length, 1);
  assert(extract(all, "memberScheduleRoundLabel").includes("!isMine || lesson?.oneDayBooking"));
  const sync = extract(all, "syncMemberScheduleV2");
  assert(sync.includes("loadMemberOwnOneDayBookingIds(client, profileId)"));
  assert(sync.includes("confirmed.ownOneDayBookingIds"));
  assert(extract(all, "setView").includes('if (enteringHome && state.dataMode === "live") void refreshMemberLiveSchedule();'));
  assert(extract(all, "logout").includes("invalidateMemberHomeSchedule()"));
  assert(read("app/tennis-note-member-app/data/sync.js").includes("async function loadMemberHomeScheduleWorkspace"));
  assert(!read("app/tennis-note-member-app/domain/schedule.js").includes("async function loadMemberHomeScheduleWorkspace"));
});

test("회원 홈: 권위 모듈로 72 일정/회차/실패·18 실제 이벤트 합성 계약", async () => {
  const context = vm.createContext({ window: {}, document: { hidden: false }, console: { warn() {} } });
  vm.runInContext(bootstrap + script + "\n" + runCases.toString() + "\n" + runRefreshEventCases.toString(), context);
  const result = await context.runCases();
  assert.equal(result.passed, 72);
  assert.deepEqual(JSON.parse(JSON.stringify(result.costs.map(row => row.workspaceRpc))), [2, 3, 3, 24, 25]);
  const events = await context.runRefreshEventCases();
  assert.equal(events.passed, 18);
  assert.equal(events.workspaceRpc, 7);
});

test("회원 홈: Chromium/WebKit 합성 16조합 (실제 기기와 별도)", { skip: process.env.TENNISNOTE_HOME_BROWSER !== "true" }, async () => {
  const { chromium, webkit } = require("playwright");
  for (const [engine, type] of [["chromium", chromium], ["webkit", webkit]]) {
    const chrome = "C:/Program Files/Google/Chrome/Application/chrome.exe";
    const browser = await type.launch({ headless: true, ...(engine === "chromium" && fs.existsSync(chrome) ? { executablePath: chrome } : {}) });
    try {
      const page = await browser.newPage();
      let network = 0; const errors = [];
      await page.route("**/*", route => { network++; return route.abort(); });
      page.on("pageerror", error => errors.push(error.message));
      await page.setContent('<!doctype html><html lang="ko"><meta name="viewport" content="width=device-width,initial-scale=1"><body><main></main></body></html>');
      await page.addScriptTag({ content: bootstrap + script + "\n" + runCases.toString() });
      for (const [width, height] of [[390, 844], [768, 1024], [1366, 900], [844, 390]]) {
        for (const colorScheme of ["light", "dark"]) {
          await page.setViewportSize({ width, height }); await page.emulateMedia({ colorScheme });
          const result = await page.evaluate(async () => {
            const result = await runCases(); document.querySelector("main").innerHTML = result.markup;
            return { passed: result.passed, cards: document.querySelectorAll("[data-home-change-lesson]").length };
          });
          assert.equal(result.passed, 72); assert.equal(result.cards, 3);
        }
      }
      assert.equal(network, 0); assert.deepEqual(errors, []);
    } finally { await browser.close(); }
  }
});
