const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const app = path.join(__dirname, "../app");
const css = fs.readFileSync(path.join(app, "shared/tennisnote-ui-foundation.css"), "utf8");

test("NFR-04 native SystemBars values precede browser env fallback on all edges", () => {
  for (const edge of ["top", "right", "bottom", "left"]) {
    assert.ok(css.includes(`--tn-safe-area-${edge}: var(--safe-area-inset-${edge}, env(safe-area-inset-${edge}, 0px));`));
  }
});

test("NFR-04 member and coach reserve the native top/sides once at the existing shell", () => {
  assert.match(css, /html\[data-tennisnote-surface="member"\] body > \.app-shell,\s*html\[data-tennisnote-surface="coach"\] body > \.coach-shell\s*\{([^}]+)\}/);
  const block = /html\[data-tennisnote-surface="coach"\] body > \.coach-shell\s*\{([^}]+)\}/.exec(css)[1];
  for (const edge of ["top", "right", "left"]) {
    assert.ok(block.includes(`padding-${edge}: var(--safe-area-inset-${edge}, 0px);`));
  }
  assert.doesNotMatch(block, /calc\(|padding-bottom|height:/);
});

test("NFR-04 public modular entries each load the canonical foundation once", () => {
  for (const surface of ["member", "coach"]) {
    const html = fs.readFileSync(path.join(app, `tennis-note-${surface}-app/index.html`), "utf8");
    assert.equal((html.match(/<link[^>]+href="\.\.\/shared\/tennisnote-ui-foundation\.css[^>]*>/g) || []).length, 1);
    assert.ok(html.includes(`data-tennisnote-surface="${surface}"`));
    assert.ok(html.includes(`class="${surface === "member" ? "app" : "coach"}-shell"`));
    assert.ok(html.includes("viewport-fit=cover"));
    assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1/);
  }
});
