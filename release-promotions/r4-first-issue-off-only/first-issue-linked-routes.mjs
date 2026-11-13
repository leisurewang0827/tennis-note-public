// Review-only linkage. No credentials, network, deploy client, or executable authority.
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildReviewPacket } from "./first-issue-release-packet.mjs";

const revision = "55da99d2d9281a69d62ac28b1467be88c9a54ab1";
const proof = "24afd3baf9def07bdd8db59ccfcc03834640d907";
const git = Object.freeze({ revision, proof, proofSourceCi: 43230254369, protectedProofPassed: false });
const install = Object.freeze(["dbInstall", "lessonGuard", "lessonStorageFence", "issueCommitFence"]);
const restore = Object.freeze(["issueFenceRestore", "lessonGuardRestore", "dbRestore"]);
const action = Object.freeze({
  install: "db-install-off", publish: "admin-publish", off: "emergency-off", webRestore: "admin-restore", dbRestore: "db-restore",
});
const hash = x => createHash("sha256").update(x).digest("hex");
const need = (v, code) => { if (!v) throw Error(code); };
const hex = (v, n) => typeof v === "string" && v.length === n && /^[0-9a-f]+$/.test(v);
const uuid = x => typeof x === "string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(x);
const stopping = /^do \$(stop|external)\$ begin raise exception 'r4_[a-z_]+'; end \$\1\$;\r?$/m;
const assembled = new WeakSet();

// Wrap exact SQL fragments in one transaction without removing any stop statement.
// The result is inspectable but cannot install/restore objects on any database.
function reviewTransaction(steps, loaded) {
  const bodies = steps.map(step => {
    const original = loaded.get(step).toString("utf8");
    const wrapper = /^((?:--[^\r\n]*\r?\n)*)begin;\r?\n([\s\S]*)\r?\ncommit;(?:\r?\n)?$/i.exec(original);
    need(wrapper && stopping.test(wrapper[2]) &&
      !/^[ \t]*(?:begin|start[ \t]+transaction|commit|rollback)(?:[ \t]+[^\r\n;]+)?;[ \t]*\r?$/mi.test(wrapper[2]),
    "R4_LINKED_SQL_WRAPPER:" + step);
    return wrapper[1] + wrapper[2];
  });
  const sql = [
    "begin;",
    "do $review$ begin raise exception 'r4_linked_route_review_only'; end $review$;",
    "set local lock_timeout='3s';",
    "set local statement_timeout='20s';",
    "select pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('tennisnote-r4-first-issue-ddl-v1',0));",
    ...bodies,
    "commit;",
    "",
  ].join("\n");
  return Object.freeze({ sql, sha256: hash(sql), parts: steps, executionAllowed: false });
}

export function assembleLinkedRoutes(repoRoot, options) {
  const loadedPaths = new Map();
  const { packet, sha256: sourcePacket } = buildReviewPacket(repoRoot, path => {
    const bytes = readFileSync(path);
    loadedPaths.set(String(path), bytes);
    return bytes;
  }, options);
  const loaded = new Map(Object.entries(packet.sources).map(([key, source]) => [
    key, loadedPaths.get(String(source.root === "repo" ? resolve(repoRoot, source.path) : new URL(source.path, import.meta.url))),
  ]));
  const apply = reviewTransaction(install, loaded), unwind = reviewTransaction(restore, loaded);
  const seal = JSON.parse(loaded.get("adminSeal"));
  const readback = loaded.get("offReadback").toString("utf8");
  need(seal.kind === "LOCAL_ONLY_NOT_DEPLOYABLE" && seal.recoveryDeployment === packet.target.adminRecoveryId &&
    seal.candidateCount === 180 && /^begin read only;\r?\n/i.test(readback) && stopping.test(readback),
  "R4_LINKED_TARGET_DRIFT");
  const routes = Object.freeze({
    [action.install]: Object.freeze({ target: packet.target.dbProjectFingerprint, transaction: apply.sha256,
      readback: packet.sources.offReadback.sha256 }),
    [action.publish]: Object.freeze({ target: packet.target.adminProject, artifact: packet.target.adminArtifact,
      seal: packet.sources.adminSeal.sha256, recovery: packet.target.adminRecoveryId }),
    [action.off]: Object.freeze({ target: packet.target.dbProjectFingerprint, armBeforeOpening: true,
      cleanup: packet.sources.scopedCleanup.sha256, readback: packet.sources.offReadback.sha256 }),
    [action.webRestore]: Object.freeze({ target: packet.target.adminProject, seal: packet.sources.adminSeal.sha256,
      recovery: packet.target.adminRecoveryId }),
    [action.dbRestore]: Object.freeze({ target: packet.target.dbProjectFingerprint, transaction: unwind.sha256,
      readback: packet.sources.offReadback.sha256 }),
  });
  const linked = hash(JSON.stringify({ git, sourcePacket, routes }));
  const bundle = Object.freeze({ linked, git, sourcePacket, routes, apply, unwind, executionAllowed: false });
  assembled.add(bundle);
  return bundle;
}

// For isolated contract testing only: boolean/state inputs here are not trusted live receipts.
export function previewLinkedRoute(bundle, step, context, observed) {
  need(assembled.has(bundle), "R4_LINKED_BUNDLE_NOT_ASSEMBLED");
  const { candidate, operation, scope } = context ?? {};
  need(candidate === bundle.git.revision && uuid(operation) && hex(scope, 64), "R4_LINKED_CONTEXT");
  need(observed?.candidate === candidate && observed.linked === bundle.linked &&
    observed.operation === operation && observed.scope === scope &&
    (step === action.off || observed.payment === "OFF"),
  "R4_LINKED_RECEIPT_SCOPE");
  const route = Object.hasOwn(bundle.routes, step) && bundle.routes[step];
  need(route, "R4_LINKED_UNKNOWN_STEP");
  const good = (r, kind) => r?.candidate === candidate && r.linked === bundle.linked &&
    r.operation === operation && r.scope === scope && r.kind === kind && r.separateRead === true;
  const off = observed.off;
  const offVerified = good(off, "committed-off") && off.enabled === false && off.active === 0;
  const installed = good(observed.install, "committed-install") &&
    observed.install.transaction === bundle.routes[action.install].transaction && observed.install.enabled === false;
  const admin = bundle.routes[action.publish];
  if (step === action.install) {
    need(observed.db?.target === route.target && observed.db.preimage === true && observed.db.acl === true &&
      observed.web?.target === admin.target && observed.web.canonical === admin.recovery && observed.web.recoveryBytes === true,
    "R4_LINKED_INSTALL_PREREQUISITES");
  } else if (step === action.publish) {
    need(installed && offVerified && observed.web?.target === route.target &&
      observed.web.canonical === route.recovery && observed.web.recoveryBytes === true &&
      observed.web.artifactId === route.artifact.id && observed.web.artifactSha === route.artifact.sha256,
    "R4_LINKED_PUBLISH_PREREQUISITES");
  } else if (step === action.off) {
    const arm = observed.arm;
    need(good(arm, "prearmed-closure") && arm.target === route.target && arm.cleanup === route.cleanup &&
      arm.beforeOpening === true && arm.openingAttempted === true && arm.closeOnly === true && arm.noLateOpen === true,
    "R4_LINKED_OFF_NOT_PREARMED");
  } else if (step === action.webRestore) {
    const bad = observed.badPublication;
    need(offVerified && good(bad, "known-bad-publication") && uuid(bad.id) && bad.id !== route.recovery &&
      observed.web?.target === route.target && observed.web.canonical === bad.id && observed.web.recoveryBytes === true,
    "R4_LINKED_WEB_RESTORE_PREREQUISITES");
  } else if (step === action.dbRestore) {
    const session = observed.session;
    need(installed && offVerified && observed.db?.target === route.target && observed.db.exactInstalledState === true &&
      good(session, "session-drained") && session.revoked === true && session.tokenExpired === true,
    "R4_LINKED_DB_RESTORE_PREREQUISITES");
  }
  return Object.freeze({ step, candidate, linked: bundle.linked, route, executionAllowed: false,
    retryOnAmbiguousWrite: false, separateReadbackRequired: true });
}
