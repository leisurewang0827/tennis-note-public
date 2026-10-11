const test = require('node:test'), assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const {restoreDurableReadback, restoreOperationStatus, durableReadbackManifest} = require('./helpers/verified-profile-phone-port.cjs');
const version = JSON.parse(fs.readFileSync(path.join(root, 'app/release.json'), 'utf8')).version;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const bounded = require('./helpers/production-isolation-historical-delta.cjs');
const read = file => {
  const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
  // 이 소비자는 durable readback 기준의 shared preimage만 비교한다.
  return bounded.restoreShared(file, source, 'public');
};
test('durable self profile four functions are exact approved private source, existing golden unchanged', () => {
  assert.equal(durableReadbackManifest.privateSourceSha, '8d3a93044acc45973886943c05ff42f92bf16952');
  assert.equal(durableReadbackManifest.files.length, 2);
  for (const row of durableReadbackManifest.files) {
    const source = read(row.path), normalized = source.replaceAll(version, durableReadbackManifest.publicVersion);
    assert.equal(hash(normalized), row.candidateSha256);
    for (const fn of row.functions) {
      const indent = row.path.includes('/shared/') ? '  ' : '';
      const body = source.match(new RegExp('^' + indent + '(?:async )?function ' + fn.name + '\\([\\s\\S]*?^' + indent + '}', 'm'));
      assert(body, fn.name); assert.equal(hash(body[0]), fn.sha256, fn.name);
    }
    assert.equal(hash(restoreDurableReadback(row.path, source).replaceAll(version, durableReadbackManifest.publicVersion)), row.baseSha256);
  }
});
test('new outer inverse rejects changed, missing and duplicated approved hunk before old golden', () => {
  for (const row of durableReadbackManifest.files) {
    const source = read(row.path), hunk = row.hunks[0];
    for (const drift of [source + '\n', source.replace(hunk.after, ''), source.replace(hunk.after, () => hunk.after + hunk.after)])
      assert.throws(() => restoreOperationStatus(row.path, drift), /candidate drift/);
  }
});
test('transport fresh/current-session/no-auth-retry and inverse layers are registered in actual consumers', () => {
  const source = read('app/tennis-note-member-app/actions/profile.js');
  assert(source.includes('limit: 2, requireFresh: true, requireCurrentSession: true, retryAuth: false'));
  assert(source.indexOf('await readSavedSelfProfileExactly') < source.indexOf('saved.profile = { ...saved.profile, ...durableProfile }'));
  const helper = read('tests/helpers/verified-profile-phone-port.cjs');
  assert(helper.includes('text = restoreDurableReadback(file, text, inputVersion)'));
  const alignment = read('scripts/check_tennisnote_dev_prod_alignment.py');
  assert(alignment.indexOf('"profile-durable-readback-source-parity.json", port["publicVersion"]')
    < alignment.indexOf('"profile-operation-status-source-parity.json", port["publicVersion"]'));
});
