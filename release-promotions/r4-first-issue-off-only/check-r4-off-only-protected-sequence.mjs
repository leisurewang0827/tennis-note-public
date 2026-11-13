import assert from 'node:assert/strict';
import { runOffOnlyProtectedSequence as run } from './r4-off-only-protected-sequence.mjs';

const plan = { commit: 'a'.repeat(40), packageSha: 'b'.repeat(64), operation: 'aabbccdd-1111-2222-3333-444444444444',
  source: '30bdd59100426cc6cee740c9b52b84c1e6c10c5d', recovery: '80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4',
  dbFingerprint: '3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a',
  project: 'tennisnote-admin', scope: 'install-off-admin-only' };
const receipt = { kind: 'R4_FIRST_ISSUE_INSTALLED_OFF_V1', onPrimary: true, controlRows: 1, disabledControlRows: 1,
  scopeRows: 0, enabledScopeRows: 0, canaryRows: 0, issuanceRows: 0, independentOff: true, independentV2Off: true,
  optionsBackupMatches: true, schedulerSha: '1ee110c0ce5fe307bd314ab81b35a88496ae55027736fa43dd6934f539db5375',
  optionsSha: '15a2c2ee776c57ee9db155d8df390ae61f6ea722e68adfd49830bdb36e0f1286' };
const test = async (mode, expected, expectedWrites) => {
  const events = [], scope = { candidate: plan.commit, packageSha: plan.packageSha, operation: plan.operation };
  let state = 'baseline', id = plan.recovery, publication = false, off = true;
  const ports = {
    assertAuthority: () => mode !== 'no-approval', claimOnce: () => mode !== 'already-claimed',
    readDb() {
      events.push('readDb');
      return { ...scope, candidate: mode === 'wrong-sha' ? 'c'.repeat(40) : scope.candidate,
        primary: true, separateRead: true, target: plan.dbFingerprint, state,
        exactOriginalCatalog: state !== 'installed', exactInstalledCatalog: state === 'installed',
        controlOff: off, enabledScopeRows: off ? 0 : 1, receipt: { ...receipt, disabledControlRows: off ? 1 : 0 } };
    },
    readWeb() {
      events.push('readWeb');
      return { ...scope, project: plan.project, recoveryVerified: true, id,
        canonicalMatchesRecovery: id === plan.recovery, noPublicationFinal: mode !== 'lost-web-no-proof',
        source: publication ? plan.source : null,
        publicationOperation: publication && mode !== 'foreign-web' ? plan.operation : null,
        status: ['bad-web', 'foreign-web'].includes(mode) ? 'failed' : 'verified', canonicalBytes: true, immutableBytes: true };
    },
    installDbOnce() {
      events.push('install');
      if (mode === 'no-install') return;
      state = 'installed'; off = mode !== 'unsafe-install';
      throw Error('lost install response');
    },
    offDbOnce() { events.push('off'); off = true; },
    restoreDbOnce() { events.push('restoreDb'); state = 'restored'; },
    publishAdminOnce() {
      events.push('publish');
      if (mode !== 'lost-web-no-proof') { publication = true; id = 'deadbeef-1111-2222-3333-555555555555'; }
      throw Error('lost publish response');
    },
    restoreAdminOnce() { events.push('restoreWeb'); id = plan.recovery; },
  };
  const result = await run(plan, ports);
  assert.equal(result.status, expected, mode);
  assert.deepEqual(events.filter(e => !e.startsWith('read')), expectedWrites, mode);
  if (events.includes('publish')) assert.ok(events.slice(events.indexOf('install')+1, events.indexOf('publish')).includes('readDb'));
};

await test('no-approval', 'PROTECTED_APPROVAL_NOT_BOUND', []);
await test('wrong-sha', 'PREFLIGHT_MISMATCH_NO_WRITE', []);
await test('already-claimed', 'APPROVAL_OR_ONE_USE_CLAIM_FAILED', []);
await test('no-install', 'INSTALL_NOT_OBSERVED_NO_RETRY', ['install']);
await test('success', 'ADMIN_PUBLISHED_DB_OFF_VERIFIED', ['install', 'publish']);
await test('unsafe-install', 'INSTALL_ANOMALY_DB_RESTORED', ['install', 'off', 'restoreDb']);
await test('bad-web', 'RELEASE_ROLLED_BACK', ['install', 'publish', 'restoreWeb', 'restoreDb']);
await test('foreign-web', 'PUBLICATION_UNKNOWN_NO_RETRY_OR_ROLLBACK', ['install', 'publish']);
await test('lost-web-no-proof', 'PUBLICATION_UNKNOWN_NO_RETRY_OR_ROLLBACK', ['install', 'publish']);
console.log('R4_OFF_ONLY_SEQUENCE_DELTA_PASS: 9 isolated scenarios; no providers');
