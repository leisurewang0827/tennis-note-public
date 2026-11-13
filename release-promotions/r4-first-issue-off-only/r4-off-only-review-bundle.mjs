// A review bundle, not an execution capability. This file never contacts providers.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { buildPinnedReviewSql } from './r4-prod-catalog-pinned-db-packet.mjs';
import { buildReviewPacket } from './first-issue-release-packet.mjs';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const offSha = '06b8d930275ee7b98d2796a5decd158994f572b1d5a25f0e60967126e204feb0';
const readSha = '91f59db56dd9758b09e1c4acfb8a4ac72361fd1cb5ae54d53f5a8eb4f63dbf79';

export function buildOffOnlyReviewBundle(checkout) {
  const { packet } = buildReviewPacket(checkout, undefined, { offOnly: true });
  const catalog = buildPinnedReviewSql(checkout, { offOnly: true });
  const off = readFileSync(resolve(checkout, 'release-sources/r4-first-issue-candidate/prod-off-template-v2.sql'));
  const read = readFileSync(new URL('prod-r4-install-committed-off-readonly.sql', import.meta.url));
  if (digest(off) !== offSha || digest(read) !== readSha || catalog.executionAllowed !== false ||
      catalog.target !== packet.target.dbProjectFingerprint) throw Error('R4_OFF_ONLY_SOURCE_DRIFT');
  const target = packet.target;
  const manifest = {
    format: 'r4-first-issue-off-only-review/v1', executionAllowed: false,
    protectedRun: null, executionGitSha: null,
    github: { repo: target.repo, ref: target.ref, environment: target.environment, environmentId: target.environmentId },
    db: { fingerprint: catalog.target, baselineReceiptSha256: catalog.receiptSha, installReviewSha256: catalog.install.sha256,
      offReviewSha256: offSha, committedOffReadSha256: readSha, restoreReviewSha256: catalog.restore.sha256 },
    admin: { project: target.adminProject, artifact: target.adminArtifact, recovery: target.adminRecoveryId,
      sealSha256: packet.sources.adminSeal.sha256 },
    limits: { branchOpen: false, issueMembership: false, saveLesson: false, otherWeb: false, auth: false, payment: false },
  };
  return { manifest, sha256: digest(JSON.stringify(manifest)) };
}

// The reader must separately pin the primary project at its provider boundary.
// A synthetic/isolated receipt cannot constitute live proof of a committed install.
export function matchesInitialOffReceipt(r) {
  return r?.kind === 'R4_FIRST_ISSUE_INSTALLED_OFF_V1' && r.onPrimary === true &&
    r.controlRows === 1 && r.disabledControlRows === 1 && r.scopeRows === 0 && r.enabledScopeRows === 0 &&
    r.canaryRows === 0 && r.issuanceRows === 0 && r.independentOff === true && r.independentV2Off === true &&
    r.schedulerSha === '1ee110c0ce5fe307bd314ab81b35a88496ae55027736fa43dd6934f539db5375' &&
    r.optionsSha === '15a2c2ee776c57ee9db155d8df390ae61f6ea722e68adfd49830bdb36e0f1286' &&
    r.optionsBackupMatches === true;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  if (process.argv.length !== 3) throw Error('Usage: node r4-off-only-review-bundle.mjs <candidate-checkout>');
  console.log(JSON.stringify(buildOffOnlyReviewBundle(process.argv[2]), null, 2));
}
