// Source-CI scope only; operation authorization and deployment remain separate.
export const EXACT_CANDIDATE_PATHS=Object.freeze([
 '.github/workflows/r4-first-issue-binding-protected.yml',
 '.github/workflows/r4-first-issue-binding-source.yml',
 ...[
  'admin-overlay-seal-v4.json','build-admin-overlay-portable.mjs','candidate-allowlist.mjs',
  'check-issue-isolated.mjs','check-source-provenance.mjs','check-v2-original-mutation-fixture.mjs',
  'fixture-original-ops.sql','issue-body.sql','issue-bridge.js','ops-overlay.sql',
  'prod-install-template-v2.sql','prod-off-template-v2.sql','prod-readback-template-v2.sql',
  'prod-restore-template-v2.sql','scoped-client-overlay-portable.mjs','source-provenance.mjs',
  'verify-admin-v4.mjs','verify-admin-artifact.mjs'
 ].map(x=>'release-sources/r4-first-issue-candidate/'+x)
]);
