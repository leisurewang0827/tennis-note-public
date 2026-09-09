import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const source = readFileSync(join(root, "app/shared/tennisnote-runtime-environment.js"), "utf8").replaceAll("\r\n", "\n");

// 격리 DOM 모델은 배포 배너 채택/중복 boot만 검사한다. 실제 44px 위치와
// Back은 별도 Chromium/WebKit 검사에서 modular 화면의 기존 함수를 실행한다.
function mount(environment, injected = true) {
  const children = [];
  const styles = [];
  const properties = new Map();
  const observers = [];
  const element = () => ({
    dataset: {}, style: {}, attributes: {}, textContent: "", isConnected: false,
    setAttribute(key, value) { this.attributes[key] = value; },
    hasAttribute(key) { return key === "data-tennisnote-internal-qa-banner" && this.dataset.tennisnoteInternalQaBanner !== undefined; },
    remove() { children.splice(children.indexOf(this), 1); this.isConnected = false; },
    getBoundingClientRect() { return { height: 34.1875 }; },
  });
  const body = {
    get firstElementChild() { return children[0] || null; },
    prepend(node) { if (children.includes(node)) children.splice(children.indexOf(node), 1); children.unshift(node); node.isConnected = true; },
  };
  const legacy = () => {
    const node = element();
    node.attributes = { role: "status", "aria-label": "개발계 안내" };
    node.textContent = "개발계 · 실제 결제·푸시 차단";
    body.prepend(node);
    return node;
  };
  const original = injected ? legacy() : null;
  const document = {
    readyState: "complete", body,
    documentElement: { dataset: {}, style: { setProperty: (key, value) => properties.set(key, value) } },
    head: { append: (node) => styles.push(node) },
    querySelector: () => styles[0] || null,
    querySelectorAll: () => children,
    createElement: element,
  };
  const window = { TENNISNOTE_CONFIG: { environment }, location: { origin: "" } };
  class Observer {
    constructor(callback) { this.callback = callback; observers.push(this); }
    observe() {}
  }
  const boot = () => new Function("window", "document", "URL", "ResizeObserver", "MutationObserver", source)(window, document, URL, Observer, Observer);
  boot();
  return { window, document, original, children, styles, properties, observers, boot, legacy };
}

test("공개 공용 runtime은 검증된 private 제품 파일과 LF SHA256이 같다", () => {
  assert.equal(createHash("sha256").update(source).digest("hex"), "cdd1f4679244b84d90479659a0b4c4be00f3c30e2f44fc77bebfb8a7f81051bf");
});

test("기존 배포 배너를 채택하고 중복 boot와 늦은 배너에서도 안내 1개만 유지한다", () => {
  const state = mount("development");
  assert.equal(state.children[0], state.original);
  assert.equal(state.children.length, 1);
  assert.equal(state.children[0].textContent, "서울 개발 · 내부 QA · 실제 결제·푸시 차단");
  assert.equal(state.properties.get("--tn-dev-qa-banner-height"), "35px");
  assert.equal(state.styles.length, 1);
  assert.equal(state.observers.length, 2);
  state.legacy();
  state.boot();
  state.boot();
  assert.equal(state.children.length, 1);
  assert.equal(state.children[0], state.original);
  assert.equal(state.styles.length, 1);
  assert.equal(state.observers.length, 2);
});

test("개발 runtime 단독도 1개이며 운영은 배너와 modal 스타일을 생성하지 않는다", () => {
  assert.equal(mount("development", false).children.length, 1);
  const production = mount("production", false);
  assert.equal(production.children.length, 0);
  assert.equal(production.styles.length, 0);
  assert.equal(production.properties.size, 0);
  assert.equal(production.observers.length, 0);
  assert.equal(production.window.TennisNoteRuntimeEnvironment.environment, "production");
});

test("실제 modular entry와 회귀 harness 연결을 유지하고 배너를 숨기는 우회는 없다", () => {
  for (const surface of ["member", "coach"]) {
    const html = readFileSync(join(root, `app/tennis-note-${surface}-app/index.html`), "utf8");
    assert.equal((html.match(/<script[^>]+src="[^"\n]*tennisnote-runtime-environment\.js/g) || []).length, 1);
  }
  assert.match(source, /html\[data-tennisnote-environment="development"\] \.lesson-edit-modal/);
  assert.doesNotMatch(source, /pointer-events\s*:\s*none|display\s*:\s*none/);
  const harness = readFileSync(join(root, "scripts/check_tennisnote_feedback_exit_ux_browser.cjs"), "utf8");
  assert.match(harness, /ui\/sheet\.js/);
  assert.match(harness, /events\/delegated\.js/);
  assert.match(harness, /module\.exports/);
  const browser = readFileSync(join(root, "scripts/check_tennisnote_dev_banner_modal_browser.cjs"), "utf8");
  assert.match(browser, /fixture\.assertLayout/);
  assert.match(browser, /fixture\.closeAndAssert/);
  assert.match(browser, /page\.goBack\(\)/);
  assert.match(browser, /xHits\.every\(Boolean\)/);
});
