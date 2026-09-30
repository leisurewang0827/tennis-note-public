import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash, webcrypto } from "node:crypto";
import vm from "node:vm";

const read = (path) => readFileSync(new URL("../" + path, import.meta.url), "utf8").replace(/\r\n/g, "\n");
const digest = (text) => createHash("sha256").update(text).digest("hex");
const receipt = JSON.parse(read("docs/tennisnote-curriculum-role-source-parity.json"));

test("커리큘럼 공유 권한과 실제 모듈 함수는 검증된 private source와 동일", () => {
  assert.match(receipt.privateSourceSha, /^[a-f0-9]{40}$/);
  assert.equal(receipt.readerEnabled, false);
  assert.equal(receipt.actualContent, "HOLD");
  assert.equal(digest(read(receipt.shared.path)), receipt.shared.sha256);
  assert.equal(receipt.functions.length, 1);
  for (const entry of receipt.functions) {
    const matches = [...read(entry.path).matchAll(new RegExp("^function " + entry.name + "\\([^]*?^}", "gm"))];
    assert.equal(matches.length, 1);
    assert.equal(digest(matches[0][0]), entry.sha256);
  }
});

function harness(t) {
  const context = vm.createContext({ TextEncoder, URL, AbortController, crypto: webcrypto,
    setTimeout: (...args) => { const timer = setTimeout(...args); timer.unref(); return timer; }, clearTimeout });
  context.window = context;
  for (const name of ["catalog", "contract", "reader", "search", "ui"]) {
    vm.runInContext(read("app/shared/tennisnote-curriculum-" + name + ".js"), context);
  }
  let projection = null, calls = 0;
  const ui = context.TennisNoteCurriculumUI.create({ catalog: context.TennisNoteCurriculumCatalog,
    readerOptions: { enabled: false, transport: { readManifest: async () => { calls++; throw Error("unexpected_remote_read"); } } },
    onCatalog: value => { projection = value; }, onClear: () => { projection = null; } });
  t.after(() => ui.clear());
  return { ui, projection: () => projection, calls: () => calls };
}
const current = (role, status = "active") => ({ user: { id: "synthetic-auth-" + role },
  profile: { id: "synthetic-profile-" + role, role, status } });

test("활성 회원·코치·관리자는 회원 화면에서 100단계 번들을 조회하고 로그아웃 때 지움", async t => {
  const h = harness(t);
  for (const role of ["member", "coach", "admin"]) {
    assert.equal(await h.ui.bindVerifiedProfile(current(role), { expires_at: Date.now() + 3600000 }), true);
    assert.equal(await h.ui.enter(), true);
    assert.equal(h.projection().steps.length, 100);
    h.ui.clear();
    assert.equal(h.ui.authorized(), false);
    assert.equal(h.projection(), null);
  }
  assert.equal(h.calls(), 0);
});

test("익명·미확인·비활성·알 수 없는 역할·만료 세션은 계속 차단", async t => {
  const h = harness(t);
  for (const profile of [{}, { user: { id: "synthetic-only-token" } }, current("coach", "blocked"),
    current("admin", "pending"), current("viewer"), { ...current("member"), profileBootstrapError: { code: "ambiguous" } }]) {
    assert.equal(await h.ui.bindVerifiedProfile(profile, { expires_at: Date.now() + 3600000 }), false);
    assert.equal(h.projection(), null);
  }
  assert.equal(await h.ui.bindVerifiedProfile(current("coach"), { expires_at: Date.now() - 1 }), false);
  assert.equal(h.calls(), 0);
});
