// 운영 실행 순서. 전송 포트는 보호 작업에서만 만들며 이 모듈은 자격증명을 읽지 않는다.
import { matchesInitialOffReceipt } from './r4-off-only-review-bundle.mjs';

const source = '30bdd59100426cc6cee740c9b52b84c1e6c10c5d';
const recovery = '80f7c05f-f66e-4144-b8d1-c09d2dbaa1d4';
const dbFingerprint = '3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a';
const uuid = v => typeof v === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(v);
const sha = (v, n) => typeof v === 'string' && v.length === n && /^[a-f0-9]+$/.test(v);
const required = ['assertAuthority', 'claimOnce', 'readDb', 'readWeb', 'installDbOnce', 'offDbOnce',
  'restoreDbOnce', 'publishAdminOnce', 'restoreAdminOnce'];

export async function runOffOnlyProtectedSequence(plan, io) {
  const fail = status => ({ status, writes: { ...writes } });
  const writes = { install: 0, publish: 0, off: 0, restoreWeb: 0, restoreDb: 0 };
  if (!plan || !sha(plan.commit, 40) || !sha(plan.packageSha, 64) || !uuid(plan.operation) ||
      plan.source !== source || plan.recovery !== recovery || plan.dbFingerprint !== dbFingerprint ||
      plan.project !== 'tennisnote-admin' || plan.scope !== 'install-off-admin-only' ||
      !required.every(key => typeof io?.[key] === 'function')) return fail('BINDINGS_MISSING');

  // A response may disappear after a commit. State is always classified by a new read.
  const observe = async read => { try { return await read(plan); } catch { return null; } };
  const scoped = r => r?.candidate === plan.commit && r?.packageSha === plan.packageSha && r?.operation === plan.operation;
  const db = async () => {
    const r = await observe(io.readDb);
    return scoped(r) && r.primary === true && r.separateRead === true && r.target === dbFingerprint ? r : null;
  };
  const web = async () => {
    const r = await observe(io.readWeb);
    return scoped(r) && r.project === 'tennisnote-admin' && r.recoveryVerified === true && uuid(r.id) ? r : null;
  };
  const originalWeb = r => r?.id === recovery && r.canonicalMatchesRecovery === true;
  const installed = r => r?.state === 'installed' && r.exactInstalledCatalog === true && matchesInitialOffReceipt(r.receipt);
  const baseline = r => r?.state === 'baseline' && r.exactOriginalCatalog === true;
  const restored = r => r?.state === 'restored' && r.exactOriginalCatalog === true && r.controlOff === true && r.enabledScopeRows === 0;
  const ownPublication = r => r && r.id !== recovery && r.source === source && r.publicationOperation === plan.operation;
  const goodPublication = r => ownPublication(r) && r.status === 'verified' &&
    r.canonicalBytes === true && r.immutableBytes === true;
  const write = async (key, fn, observation) => {
    if (writes[key] !== 0) throw Error('R4_OFF_ONLY_REPLAY');
    writes[key] = 1;
    try { await fn(plan, observation); } catch { /* no retry; classify with separate read */ }
  };

  if (await observe(io.assertAuthority) !== true) return fail('PROTECTED_APPROVAL_NOT_BOUND');
  const [before, webBefore] = await Promise.all([db(), web()]);
  if (!baseline(before) || !originalWeb(webBefore)) return fail('PREFLIGHT_MISMATCH_NO_WRITE');
  if (await observe(io.assertAuthority) !== true || await observe(io.claimOnce) !== true) return fail('APPROVAL_OR_ONE_USE_CLAIM_FAILED');
  await write('install', io.installDbOnce, before);
  let after = await db();
  if (baseline(after)) return fail('INSTALL_NOT_OBSERVED_NO_RETRY');
  if (!installed(after)) {
    // Only an exact installed image may be touched by the incident closure.
    if (after?.state !== 'installed' || after.exactInstalledCatalog !== true) return fail('INSTALL_STATE_UNKNOWN_NO_RETRY');
    await write('off', io.offDbOnce, after);
    after = await db();
    if (!installed(after)) return fail('OFF_NOT_CONFIRMED_NO_PUBLISH');
    await write('restoreDb', io.restoreDbOnce, after);
    return fail(restored(await db()) ? 'INSTALL_ANOMALY_DB_RESTORED' : 'DB_RESTORE_UNCONFIRMED');
  }
  if (!originalWeb(await web()) || await observe(io.assertAuthority) !== true) {
    await write('restoreDb', io.restoreDbOnce, after);
    return fail(restored(await db()) ? 'PUBLISH_PRECONDITION_FAILED_DB_RESTORED' : 'DB_RESTORE_UNCONFIRMED');
  }
  await write('publish', io.publishAdminOnce, after);
  const published = await web();
  const currentDb = await db();
  if (goodPublication(published) && installed(currentDb)) return fail('ADMIN_PUBLISHED_DB_OFF_VERIFIED');
  if (!installed(currentDb)) {
    if (currentDb?.state !== 'installed' || currentDb.exactInstalledCatalog !== true) return fail('POST_PUBLISH_DB_UNKNOWN');
    await write('off', io.offDbOnce, currentDb);
    if (!installed(await db())) return fail('OFF_NOT_CONFIRMED');
  }
  if (!ownPublication(published) && !(originalWeb(published) && published.noPublicationFinal === true))
    return fail('PUBLICATION_UNKNOWN_NO_RETRY_OR_ROLLBACK');
  if (ownPublication(published)) {
    // Do not roll back somebody else's concurrent release.
    const current = await web();
    if (!ownPublication(current) || current.id !== published.id) return fail('CANONICAL_CHANGED_NO_ROLLBACK');
    await write('restoreWeb', io.restoreAdminOnce, current);
    if (!originalWeb(await web())) return fail('WEB_RESTORE_UNCONFIRMED_DB_LEFT_OFF');
  }
  const beforeRestore = await db();
  if (!installed(beforeRestore)) return fail('RESTORE_PRECONDITION_DB_NOT_OFF');
  await write('restoreDb', io.restoreDbOnce, beforeRestore);
  return fail(restored(await db()) ? 'RELEASE_ROLLED_BACK' : 'DB_RESTORE_UNCONFIRMED');
}
