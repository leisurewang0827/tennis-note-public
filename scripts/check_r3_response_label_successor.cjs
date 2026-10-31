"use strict";

// Pure local source-scope contract. This module does not authorize CI skips or deployment.
// A reviewed workflow/CI/target binding must be added separately before any remote use.
const BASE = "efc84a88a389b292ff226b760c935de19ac9f07b";
const SOURCE = "fb4c6a6377c0efaf64d63fbfb219688b7bc0e9e4";
const METADATA = "be29bbc2f7b18ba05eb8f943a0640cb9205c9578";
const CORRECTIVE = "e760e655080466e436146c483dc249aca9213fc0";
const BRANCH = "codex/tennisnote-r3-admin-response-label-dev571-20261031";
const PROJECT = "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba";
const META = Object.freeze([
  "app/admin/index.html", "app/release.json", "app/shared/tennisnote-release.js",
  "app/tennis-note-coach-app/app.js", "app/tennis-note-coach-app/domain/coaches.js",
  "app/tennis-note-coach-app/forms/common.js", "app/tennis-note-coach-app/index.html",
  "app/tennis-note-coach-app/service-worker.js", "app/tennis-note-member-app/app.js",
  "app/tennis-note-member-app/forms/common.js", "app/tennis-note-member-app/index.html",
  "app/tennis-note-member-app/service-worker.js", "app/tennis-note-member-app/ui/screens.js",
]);
const PIN = Object.freeze({
  "app/admin/views/billing.js": "ce7e39d73116a20f16173153a1a22035f9d9c6da3f2d13bd001c367df917dd3d",
  "tests/r3-admin-response-label.test.js": "18ee3149915c3c165b98b00b543f1bd39911ffaeec4073e940ac394853c90746",
  "app/admin/index.html": "a96fee16f09a376844ffa7de153cb3f45cb40d2692363f7bd11ae6b3f612a8fe",
  "app/release.json": "b6ecb21530a1539a2e50babddf2e62630e78a89da478bf13d68f1da5034b9ff5",
  "app/shared/tennisnote-release.js": "cbb71a953935dd326c77782f72b6721935123578c60e6a590c6ee4efddad7d2b",
  "app/tennis-note-coach-app/app.js": "efdbd935adf59e28cdb905bed748945d106445e4d570b766a2fd2117aa570c2a",
  "app/tennis-note-coach-app/domain/coaches.js": "da599c1b8e9a4d4433e90f876e5c33060552c41c7bf0b6df0216ce570f51b19d",
  "app/tennis-note-coach-app/forms/common.js": "a128b3cd94d3a2aa85ef6da54a10c17bc0e4b0c577732f7b7a6673986a9cb8b2",
  "app/tennis-note-coach-app/index.html": "1e93d2e709f77d003ba7e81a2ee32079765fbc075af6c1a260b3848e09d45da2",
  "app/tennis-note-coach-app/service-worker.js": "8af0e8c99e22b559096869d3af3fee17756f20466cc7f65c94c96fd7420a90a6",
  "app/tennis-note-member-app/app.js": "a15f6e41fde9d432096c7b69bbfff915135bc9bebbb3b10eedb69dea4f4106eb",
  "app/tennis-note-member-app/forms/common.js": "30f3309720e1d7d43bc0ee8beb26f1f977c12b5aeb8bdde0a4c26c7cddd9907e",
  "app/tennis-note-member-app/index.html": "625183a6f36257725e5275063a28d5476967846dc07460482502cfde391d4447",
  "app/tennis-note-member-app/service-worker.js": "590a872b12197e07afed71028c37b0bd86c7d1be9ac0c727e943b0aab426f1c3",
  "app/tennis-note-member-app/ui/screens.js": "b6194d3ac7e75a6cc23065c71c9a87f84bc0663248286d4a14ba9a3e96365b9c",
});
const need = (ok) => { if (!ok) throw new Error("STATUS_SUCCESSOR_HOLD"); };

function validateLocalScope(s) {
  need(s && s.base === BASE && s.branch === BRANCH && s.environment === "development"
    && s.projectFingerprint === PROJECT && s.rollbackCommit === BASE
    && s.version === "1.0.571" && s.releaseId === "2026.10.31.02"
    && s.memberCache === 604 && s.coachCache === 577
    && s.nativeBuildChanged === false && s.databaseAction === false
    && Array.isArray(s.paths) && s.hashes && typeof s.hashes === "object");
  const expected = Object.keys(PIN).sort();
  const paths = [...s.paths].sort();
  need(paths.length === expected.length && new Set(paths).size === paths.length
    && paths.every((p, i) => p === expected[i])
    && Object.keys(s.hashes).sort().length === expected.length
    && Object.keys(s.hashes).sort().every((p, i) => p === expected[i])
    && expected.every((p) => Object.hasOwn(s.hashes, p) && s.hashes[p] === PIN[p]));
  return Object.freeze({ status: "LOCAL_SCOPE_ONLY_NOT_DEPLOYABLE", files: expected.length });
}

// Metadata validation is not a trusted collector: never treat its output as CI evidence.
function validatePrBoundary(s) {
  const sha = (x) => typeof x === "string" && /^[a-f0-9]{40}$/.test(x) && !/^0+$/.test(x);
  const repo = "leisurewang0827/tennis-note-public";
  need(s && s.event === "pull_request" && s.repo === repo && s.baseRepo === repo && s.headRepo === repo
    && s.base === BASE && s.baseRef === "codex/tennisnote-r3-current-term-dev570-20261031"
    && s.headRef === BRANCH && s.attempt === 1 && Number.isSafeInteger(s.number) && s.number > 0
    && s.ref === `refs/pull/${s.number}/merge` && s.workflow === "Tennis Note Public PWA CI"
    && s.workflowRef === `${repo}/.github/workflows/tennisnote-public-ci.yml@${s.ref}`
    && sha(s.head) && s.source === SOURCE && s.metadata === METADATA && sha(s.merge) && sha(s.headTree) && s.headTree === s.mergeTree
    && s.corrective === CORRECTIVE && Array.isArray(s.headParents) && s.headParents.length === 1 && s.headParents[0] === CORRECTIVE
    && Array.isArray(s.correctiveParents) && s.correctiveParents.length === 1 && s.correctiveParents[0] === METADATA
    && Array.isArray(s.metadataParents) && s.metadataParents.length === 1 && s.metadataParents[0] === SOURCE
    && Array.isArray(s.sourceParents) && s.sourceParents.length === 1 && s.sourceParents[0] === BASE
    && Array.isArray(s.mergeParents) && s.mergeParents.length === 2
    && s.mergeParents[0] === BASE && s.mergeParents[1] === s.head
    && s.githubSha === s.merge && s.workflowSha === s.merge && s.clean === true && s.indexClean === true);
  return Object.freeze({ status: "PR_METADATA_ONLY_NOT_ADMITTED" });
}

// Independent 572 successor. The 571 pins and validators above remain unchanged.
const PHONE_PREDECESSOR = "470a2b9427eaf29aff9e6dd9b89ab608145dfa37";
const PHONE_CORRECTIVE_BASE = "328a174047651a839910e2f678d9471bc762cdb0";
const PHONE_PIN = Object.freeze({
  "app/admin/domain/coaches.js": "bba3e4430b43a293197f83c1a5b6f607acb2098712f95bef19147d98fd3b52ac",
  "app/admin/index.html": "44cae729bd125f3eb539e3ac9d07c8b84738c36902d85143043e68e5d7dedc21",
  "app/release.json": "6b7586383e02636a190576a7c141626c3bca3273c8141cb28ce5b48d7932579a",
  "app/shared/tennisnote-release.js": "aca5f8b728116a320a6026aa4de331613063c870c5f548116fddc35d0e93e1e8",
  "app/tennis-note-coach-app/app.js": "ff1c22f51afddb5fcb5e5c8fbb3101b73907f7e714411754ae7ec1907e93ea0a",
  "app/tennis-note-coach-app/domain/coaches.js": "bb1dd7d4e8b5bfedce158fa4c0e267d2e05c3fe3cccd181512c1182abcbd2529",
  "app/tennis-note-coach-app/forms/common.js": "d4c665b17af57d5a434fc59cf2cfee587ccf71ce8de904a4872c11984da2b279",
  "app/tennis-note-coach-app/index.html": "89fe3af8b604fdd4a33e028bc4a650f35d5359c13c641ef2898a11c40dc3619a",
  "app/tennis-note-coach-app/service-worker.js": "023b3b340230cc6d6c07efd8132b5ce0c29eddb3765beb9b0077271429b1668d",
  "app/tennis-note-member-app/app.js": "2c1a8b47866b4e74c3246cf5734978742eb742676daf93e0a601b6926b2f9496",
  "app/tennis-note-member-app/forms/common.js": "5a6b7a1476ff87783664a8484be6b7698f8d054a54f404ef1f8f8d8db3957cb6",
  "app/tennis-note-member-app/index.html": "41307efba34b4c0a364248b5a4fdd88ee84b35a5e7d88bc72870c82902097f7a",
  "app/tennis-note-member-app/service-worker.js": "2f87a1487a91e909f7d5cf78da086ba6bdb04dfed2af05822078728db12dc80b",
  "app/tennis-note-member-app/ui/screens.js": "8bac4b0dded9d780164c991834c346c187e3b8907cd7c903ecf1ff6e1715249b",
  "tests/coach-staff-settlement-readback.test.js": "c59ab7827fc2066e389d46a3a612ff9fced9d6c57fe23295c1bc7bdfa9bea92c",
});
function validatePhoneLocalScope(s) {
  need(s && s.predecessor === PHONE_PREDECESSOR && s.branch === BRANCH
    && s.environment === "development" && s.projectFingerprint === PROJECT
    && s.rollbackCommit === PHONE_PREDECESSOR && s.version === "1.0.572"
    && s.releaseId === "2026.10.31.03" && s.memberCache === 605 && s.coachCache === 578
    && s.nativeBuildChanged === false && s.databaseAction === false
    && Array.isArray(s.paths) && s.hashes && typeof s.hashes === "object");
  const expected = Object.keys(PHONE_PIN).sort();
  const paths = [...s.paths].sort();
  need(paths.length === expected.length && new Set(paths).size === paths.length
    && paths.every((p, i) => p === expected[i])
    && Object.keys(s.hashes).sort().length === expected.length
    && Object.keys(s.hashes).sort().every((p, i) => p === expected[i])
    && expected.every((p) => Object.hasOwn(s.hashes, p) && s.hashes[p] === PHONE_PIN[p]));
  return Object.freeze({ status: "LOCAL_SCOPE_ONLY_NOT_DEPLOYABLE", files: expected.length });
}

function validatePhonePriorRun(run, currentHead) {
  need(run && run.id === 41166580662 && run.head_sha === PHONE_PREDECESSOR
    && run.event === "pull_request" && run.run_attempt === 1 && run.status === "completed"
    && run.conclusion === "success" && run.name === "Tennis Note Public PWA CI"
    && run.workflow_id === 329932540 && run.path === ".github/workflows/tennisnote-public-ci.yml"
    && run.repository?.full_name === "leisurewang0827/tennis-note-public"
    && run.head_repository?.full_name === "leisurewang0827/tennis-note-public"
    && Array.isArray(run.pull_requests) && run.pull_requests.length === 1
    && /^[a-f0-9]{40}$/.test(currentHead || "")
    && run.pull_requests[0].number === 228 && run.pull_requests[0].head?.sha === currentHead
    && run.pull_requests[0].base?.sha === BASE);
  return Object.freeze({ status: "PREDECESSOR_RUN_METADATA_ONLY", deploymentAdmitted: false });
}

function validatePhonePrGraph(s) {
  const sha = (x) => typeof x === "string" && /^[a-f0-9]{40}$/.test(x) && !/^0+$/.test(x);
  const repo = "leisurewang0827/tennis-note-public";
  need(s && s.event === "pull_request" && s.repo === repo && s.baseRepo === repo && s.headRepo === repo
    && s.base === BASE && s.baseRef === "codex/tennisnote-r3-current-term-dev570-20261031"
    && s.headRef === BRANCH && s.attempt === 1 && s.number === 228
    && s.ref === "refs/pull/228/merge" && s.workflow === "Tennis Note Public PWA CI"
    && s.workflowRef === `${repo}/.github/workflows/tennisnote-public-ci.yml@${s.ref}`
    && sha(s.head) && sha(s.merge) && sha(s.headTree) && s.headTree === s.mergeTree
    && Array.isArray(s.headParents) && s.headParents.length === 1 && s.headParents[0] === PHONE_CORRECTIVE_BASE
    && Array.isArray(s.correctiveParents) && s.correctiveParents.length === 1 && s.correctiveParents[0] === PHONE_PREDECESSOR
    && Array.isArray(s.mergeParents) && s.mergeParents.length === 2
    && s.mergeParents[0] === BASE && s.mergeParents[1] === s.head
    && s.githubSha === s.merge && s.workflowSha === s.merge && s.clean === true && s.indexClean === true);
  return Object.freeze({ status: "PHONE_PR_METADATA_ONLY_NOT_ADMITTED" });
}

function validatePhonePriorJobs(jobs) {
  need(jobs && Array.isArray(jobs.jobs) && jobs.jobs.length === 1);
  const job = jobs.jobs[0];
  need(job.name === "build-and-check" && job.status === "completed" && job.conclusion === "success"
    && Array.isArray(job.steps) && job.steps.filter((step) => step.name === "Admit exact response-label successor"
      && step.status === "completed" && step.conclusion === "success").length === 1);
  return true;
}

function validatePhoneDeltaRows(rows, wiring) {
  need(Array.isArray(rows) && Array.isArray(wiring) && new Set(wiring).size === wiring.length);
  const allowed = [...Object.keys(PHONE_PIN), ...wiring].sort();
  need(new Set(allowed).size === allowed.length && rows.length === allowed.length
    && rows.every((row) => Array.isArray(row) && row.length === 2 && row[0] === "M")
    && new Set(rows.map((row) => row[1])).size === rows.length
    && rows.map((row) => row[1]).sort().every((p, i) => p === allowed[i]));
  return true;
}

module.exports = { validateLocalScope, validatePrBoundary, PIN, META, BASE, SOURCE, METADATA, CORRECTIVE, BRANCH, PROJECT,
  PHONE_PREDECESSOR, PHONE_CORRECTIVE_BASE, PHONE_PIN, validatePhoneLocalScope, validatePhonePriorRun, validatePhonePrGraph,
  validatePhonePriorJobs, validatePhoneDeltaRows };
