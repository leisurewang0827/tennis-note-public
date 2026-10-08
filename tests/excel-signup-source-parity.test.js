const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const manifest = JSON.parse(read('docs/excel-signup-source-parity-20261001.json'));
const hash = s => createHash('sha256').update(s).digest('hex');
const { restorePhone } = require('./helpers/verified-profile-phone-port.cjs');
for (const item of manifest.shared) test(`Excel private source parity: ${item.path}`, () => {
  assert.equal(hash(read(item.path)), item.sha256);
});
for (const item of manifest.functions) test(`Signup modular authority: ${item.name}`, () => {
  const body = restorePhone(item.path, read(item.path)).match(new RegExp('^(?:async )?function ' + item.name + '\\([^]*?^}', 'm'))?.[0];
  assert.ok(body);
  assert.equal(hash(body), item.sha256);
  const relative = item.path.replace('app/tennis-note-member-app/', '');
  assert.ok(read('app/tennis-note-member-app/index.html').includes(relative));
  assert.ok(read('app/tennis-note-member-app/service-worker.js').includes(relative));
});
test('preserved public catalog and empty-warning coverage plus private WebKit clear event', () => {
  const browser = read('scripts/check_tennisnote_single_sheet_preview_browser.cjs');
  for (const marker of ['check_tennisnote_single_sheet_products_browser.cjs', 'REMOTE_EMPTY_PREPARE_PREVIEW_MUTATION_ZERO',
    'ACTUAL_SERVER_INCOMPLETE_NO_MUTATION', 'TENNISNOTE_EXCEL_EMPTY_WARNING_ONLY',
    'window.__sheetExecution.fileChanges > before', 'beforeClear, { timeout: 5000 }', 'COMPLETION_START_INPUT_CLEARED']) {
    assert.ok(browser.includes(marker), marker);
  }
  assert.match(browser, /remotePreviewScenario\(browser, engine, "production"\)/);
});
test('signup transport guards and memory-only duplicate/replay state', () => {
  const auth = read('app/tennis-note-member-app/data/auth.js');
  const submit = read('app/tennis-note-member-app/actions/enrollment.js');
  assert.ok(auth.includes('target_operation_key: signupProfileOperation.key'));
  assert.ok(auth.includes('await requireVerifiedIdentityPhone(normalizedPhone)'));
  assert.ok(submit.includes('if (signupProfileSubmitting) return;'));
  assert.equal((submit.match(/let signupProfileSubmitting = false/g) || []).length, 1);
  assert.equal((auth.match(/let signupProfileOperation =/g) || []).length, 1);
  assert.ok(!auth.includes('localStorage.setItem'));
});
