const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = p => fs.readFileSync(path.join(root, p), 'utf8').replace(/\r\n/g, '\n');
const manifest = JSON.parse(read('docs/excel-onboarding-a-source-parity-20261002.json'));
for (const item of manifest.shared) test(`Excel A 승인 source 전체 일치: ${item.path}`, () => {
  assert.equal(createHash('sha256').update(read(item.path)).digest('hex'), item.sha256);
  if (item.path.endsWith('tennisnote-single-sheet-import.js')) {
    // 파서는 공식 양식 다운로드 시 preview UI에서 지연 로드한다.
    assert.match(read('app/shared/tennisnote-single-sheet-preview-ui.js'), /await loadTemplateDependency\("\.\/tennisnote-single-sheet-import\.js"/);
    assert.match(read('app/admin/index.html'), /\.\.\/shared\/tennisnote-single-sheet-preview-ui\.js/);
  } else {
    assert.ok(read('app/admin/index.html').includes(item.path.replace('app/', '../')));
  }
});
test('Excel A 상품32 및 코치 드롭다운·변조·지점 변경·읽기 전용 계약', async () => {
  const count = await require('../scripts/check_tennisnote_single_sheet_onboarding.cjs').run();
  assert.equal(count, 28);
});
