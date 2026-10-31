"use strict";

// Read-only facts only: never emits a CI skip, deployment permit, credentials or raw paths.
const { execFileSync } = require("node:child_process");
const { readFileSync, lstatSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { resolve } = require("node:path");
const { validatePrBoundary, PIN, META, BASE, SOURCE, METADATA, CORRECTIVE, BRANCH, PROJECT,
  PHONE_PREDECESSOR, PHONE_PIN, validatePhoneLocalScope, validatePhonePrGraph,
  validatePhonePriorRun, validatePhonePriorJobs, validatePhoneDeltaRows } = require("./check_r3_response_label_successor.cjs");
const ROOT = resolve(__dirname, "..");
const REPO = "leisurewang0827/tennis-note-public";
const BASE_REF = "codex/tennisnote-r3-current-term-dev570-20261031";
const WIRING = Object.freeze([
  "scripts/check_r3_response_label_successor.cjs",
  "tests/r3-response-label-successor-core.test.cjs",
  "scripts/collect_r3_response_label_pr.cjs",
  "tests/r3-response-label-collector.test.cjs",
  "tests/r3-response-label-deploy.test.py",
  ".github/workflows/tennisnote-public-ci.yml",
  ".github/workflows/deploy-cloudflare-pages-dev.yml",
  "scripts/check_r3_dev_deployment.py",
]);
const FIX = Object.freeze([
  ".github/workflows/tennisnote-public-ci.yml", "scripts/check_r3_dev_deployment.py",
  "scripts/check_r3_response_label_successor.cjs", "scripts/collect_r3_response_label_pr.cjs",
  "tests/r3-response-label-successor-core.test.cjs", "tests/r3-response-label-collector.test.cjs",
  "tests/r3-response-label-deploy.test.py",
]);
const AUTH_FIX = Object.freeze([...FIX, ".github/workflows/deploy-cloudflare-pages-dev.yml"]);
// Exact 572 successor wiring; the previous 571 lists and validators remain unchanged.
const PHONE_WIRING = Object.freeze([
  ".github/workflows/tennisnote-public-ci.yml", "scripts/check_r3_dev_deployment.py",
  "scripts/check_r3_response_label_successor.cjs", "scripts/collect_r3_response_label_pr.cjs",
  "tests/r3-response-label-successor-core.test.cjs", "tests/r3-response-label-collector.test.cjs",
  "tests/r3-response-label-deploy.test.py",
]);
const BASE_BLOBS = Object.freeze([
  ["c3823d163e7e8acbb3e69c591273f586425bbcea", 11453, "ef74017550fb4c8f18142424792d81e3f953740bf9880366732b32a65d9ebccd"],
  ["c5c263549ee1961a3acf68565a9e23cb2ef67462", 3455, "2118c7c378086e74262b48b0a0495e42abe35f9e34f2e7d3f4f50f6762b3bdd9"],
]);
const NEW_HEAD_CONDITION = "github.event_name == 'pull_request' && github.head_ref == 'codex/tennisnote-r3-admin-response-label-dev571-20261031'";
const INTRO = `      - name: Check out response-label successor\n        if: ${NEW_HEAD_CONDITION}\n        uses: actions/checkout@v7\n        with:\n          ref: \${{ github.sha }}\n          fetch-depth: 0\n          sparse-checkout-cone-mode: false\n          sparse-checkout: |\n${[...Object.keys(PIN), ...WIRING, "tests/fixtures/r3-dev-cache-floors.json"].map((p) => `            /${p}\n`).join("")}      - uses: actions/setup-node@v7\n        if: ${NEW_HEAD_CONDITION}\n        with:\n          node-version: "22"\n      - uses: actions/setup-python@v7\n        if: ${NEW_HEAD_CONDITION}\n        with:\n          python-version: "3.12"\n      - name: Admit exact response-label successor\n        id: response_label\n        if: ${NEW_HEAD_CONDITION}\n        run: |\n          node scripts/collect_r3_response_label_pr.cjs > "$RUNNER_TEMP/r3-status-source-receipt.json"\n          node scripts/collect_r3_response_label_pr.cjs --verify-receipt "$RUNNER_TEMP/r3-status-source-receipt.json"\n          node --test tests/r3-admin-response-label.test.js\n          node --test --test-name-pattern='PR metadata|inherited hashes' tests/r3-response-label-successor-core.test.cjs\n          node --test --test-name-pattern='workflow wrapper|scoped signal|receipt' tests/r3-response-label-collector.test.cjs\n          python tests/r3-response-label-deploy.test.py\n          echo 'scoped=true' >> "$GITHUB_OUTPUT"\n`;
function wrapWorkflow(base) {
  const marker = "    steps:\n";
  need(base.split(marker).length === 2, "WORKFLOW_BASE");
  const [prefix, body] = base.split(marker);
  const parts = body.split(/(?=^      - )/m);
  const wrapped = parts.map((part) => {
    if (!part.startsWith("      - ")) return part;
    const match = part.match(/^        if: (.+)$/m);
    if (match) {
      const old = match[1].replace(/^\$\{\{\s*/, "").replace(/\s*\}\}$/, "");
      return part.replace(match[0], `        if: steps.response_label.outputs.scoped != 'true' && (${old})`);
    }
    return part.replace(/\n/, "\n        if: steps.response_label.outputs.scoped != 'true'\n");
  }).join("");
  const original = '          node scripts/collect_r3_response_label_pr.cjs > "$RUNNER_TEMP/r3-status-source-receipt.json"\n';
  need(INTRO.split(original).length === 2, "WORKFLOW_PREP_ANCHOR");
  const replacement = `          node scripts/collect_r3_response_label_pr.cjs --prepare-base\n          if ! node scripts/collect_r3_response_label_pr.cjs > "$RUNNER_TEMP/r3-status-source-receipt.json"; then\n            node scripts/collect_r3_response_label_pr.cjs --show-hold "$RUNNER_TEMP/r3-status-source-receipt.json"\n            exit 1\n          fi\n`;
  const priorTests = `          node --test tests/r3-admin-response-label.test.js\n          node --test --test-name-pattern='PR metadata|inherited hashes' tests/r3-response-label-successor-core.test.cjs\n          node --test --test-name-pattern='workflow wrapper|scoped signal|receipt' tests/r3-response-label-collector.test.cjs\n          python tests/r3-response-label-deploy.test.py\n`;
  const authTests = `          node --test --test-name-pattern='fourth layer' tests/r3-response-label-successor-core.test.cjs\n          node --test --test-name-pattern='auth fourth|auth deploy' tests/r3-response-label-collector.test.cjs\n          python tests/r3-response-label-deploy.test.py StatusDeploy.test_authenticated_fixed_github_path_and_no_fallback StatusDeploy.test_authenticated_http_errors_are_role_coded_and_redacted StatusDeploy.test_auth_fourth_layer_graph\n`;
  need(INTRO.split(priorTests).length === 2, "WORKFLOW_TEST_ANCHOR");
  return prefix + marker + INTRO.replace(original, replacement).replace(priorTests, authTests) + wrapped;
}
function wrapDeployWorkflow(base) {
  const marker = "      - name: Admit exact manual R3 candidate\n";
  need(base.split(marker).length === 2, "DEPLOY_WORKFLOW_BASE");
  let result = base.replace(marker, "      - uses: actions/setup-node@v7\n        with:\n          node-version: \"22\"\n\n" + marker);
  const sourceStep = "      - name: Admit exact manual R3 candidate\n        if: github.event_name == 'workflow_dispatch'\n";
  need(result.split(sourceStep).length === 2, "DEPLOY_SOURCE_ANCHOR");
  result = result.replace(sourceStep, sourceStep + "        env:\n          STATUS_GITHUB_TOKEN: ${{ github.token }}\n");
  const liveStep = "      - name: Verify exact existing development target and rollback before manual deploy\n        if: github.event_name == 'workflow_dispatch'\n        env:\n";
  need(result.split(liveStep).length === 2, "DEPLOY_LIVE_ANCHOR");
  return result.replace(liveStep, liveStep + "          STATUS_GITHUB_TOKEN: ${{ github.token }}\n");
}
const need = (value, code) => { if (!value) throw Error(code); };
function safeHold(error) {
  const message = String(error?.message || "");
  const allowed = new Set(["DIRTY_WORKTREE", "DIRTY_INDEX", "EVENT_CONTEXT", "PR_CONTEXT", "PR_READ_FAILED", "PR_READ_LIMIT", "PR_DRIFT", "SOURCE_PARENT", "WORKFLOW_INVERSE", "DEPLOY_WORKFLOW_INVERSE", "PATH_SCOPE", "LAYER_SCOPE", "FILE_MODE", "SYMLINK", "FILE_DRIFT", "PRODUCT_PIN", "POST_DRIFT", "RECEIPT_HOLD", "RECEIPT_CONTEXT", "RECEIPT_GRAPH", "ARGUMENT_HOLD", "PREP_CONTEXT", "PREP_GRAPH", "BLOB_SHAPE", "BLOB_ENCODING", "BLOB_IDENTITY", "BLOB_HTTP", "BLOB_HTTP_LIMIT", "BLOB_STORE", "BLOB_MISSING"]);
  return { status: "HOLD", reason: allowed.has(message) ? message : "COLLECTION_HOLD", deploymentAdmitted: false };
}
function validateLayerRows(rows, paths, expectedStatus) {
  const sorted = [...paths].sort();
  need(Array.isArray(rows) && rows.length === sorted.length && new Set(rows.map((x) => x[1])).size === sorted.length
    && rows.map((x) => x[1]).sort().every((p, i) => p === sorted[i])
    && rows.every(([status, p]) => expectedStatus(p) === status), "LAYER_SCOPE");
}
function expectedFileStatus(p) {
  const added = p.startsWith("tests/r3-admin-response-label.") || p.startsWith("tests/r3-response-label-")
    || p.startsWith("scripts/check_r3_response_label_") || p === "scripts/collect_r3_response_label_pr.cjs";
  return added ? "A" : "M";
}
function decodePinnedBlob(payload, oid, size, lfHash) {
  need(payload && payload.sha === oid && payload.encoding === "base64" && payload.size === size
    && typeof payload.content === "string" && payload.content.length < 100000, "BLOB_SHAPE");
  const text = payload.content.replace(/[\r\n]/g, "");
  need(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text), "BLOB_ENCODING");
  const bytes = Buffer.from(text, "base64");
  need(bytes.length === size && bytes.toString("base64") === text
    && createHash("sha1").update(Buffer.from(`blob ${size}\0`)).update(bytes).digest("hex") === oid
    && digest(bytes.toString("utf8")) === lfHash, "BLOB_IDENTITY");
  return bytes;
}
async function ensurePinnedBlobs(records, readBlob, fetchBlob, writeBlob) {
  const prepared = [];
  for (const [oid, size, lfHash] of records) {
    let bytes = await readBlob(oid);
    if (bytes === null) {
      bytes = decodePinnedBlob(await fetchBlob(oid), oid, size, lfHash);
      need(await writeBlob(bytes) === oid, "BLOB_STORE");
      bytes = await readBlob(oid);
    }
    need(Buffer.isBuffer(bytes), "BLOB_MISSING");
    decodePinnedBlob({ sha: oid, size, encoding: "base64", content: bytes.toString("base64") }, oid, size, lfHash);
    prepared.push(true);
  }
  return prepared;
}
async function prepareBaseBlobs() {
  const env = process.env;
  need(env.GITHUB_EVENT_NAME === "pull_request" && env.GITHUB_REPOSITORY === REPO && env.GITHUB_RUN_ATTEMPT === "1"
    && env.GITHUB_BASE_REF === BASE_REF && env.GITHUB_HEAD_REF === BRANCH && env.GITHUB_EVENT_PATH, "PREP_CONTEXT");
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")), pr = event.pull_request;
  const head = pr?.head?.sha, merge = git("rev-parse", "HEAD");
  need(Number.isSafeInteger(event.number) && event.number > 0 && pr?.number === event.number
    && event.repository?.full_name === REPO && pr?.head?.repo?.full_name === REPO && pr?.base?.repo?.full_name === REPO
    && pr?.head?.ref === BRANCH && pr?.base?.ref === BASE_REF && pr?.base?.sha === BASE
    && /^[a-f0-9]{40}$/.test(head || "") && env.GITHUB_REF === `refs/pull/${event.number}/merge`
    && env.GITHUB_SHA === merge && env.GITHUB_WORKFLOW_SHA === merge
    && env.GITHUB_WORKFLOW === "Tennis Note Public PWA CI"
    && env.GITHUB_WORKFLOW_REF === `${REPO}/.github/workflows/tennisnote-public-ci.yml@${env.GITHUB_REF}`
    && git("show", "-s", "--format=%P", head) === CORRECTIVE
    && git("show", "-s", "--format=%P", CORRECTIVE) === METADATA
    && git("show", "-s", "--format=%P", METADATA) === SOURCE
    && git("show", "-s", "--format=%P", SOURCE) === BASE
    && git("show", "-s", "--format=%P", merge) === `${BASE} ${head}`
    && git("rev-parse", `${merge}^{tree}`) === git("rev-parse", `${head}^{tree}`)
    && git("status", "--porcelain", "--untracked-files=all") === "", "PREP_GRAPH");
  const prepared = await ensurePinnedBlobs(BASE_BLOBS,
    async (oid) => {
      try { return execFileSync("git", ["cat-file", "blob", oid], { cwd: ROOT, env: { ...env, GIT_NO_LAZY_FETCH: "1" }, timeout: 15000, maxBuffer: 100000, stdio: ["ignore", "pipe", "pipe"] }); }
      catch { return null; }
    },
    async (oid) => {
      const r = await fetch(`https://api.github.com/repos/${REPO}/git/blobs/${oid}`, {
        headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" },
        redirect: "error", signal: AbortSignal.timeout(15000),
      });
      need(r.ok && r.body, "BLOB_HTTP");
      const reader = r.body.getReader(), chunks = []; let total = 0;
      for (;;) { const next = await reader.read(); if (next.done) break; total += next.value.length;
        need(total <= 100000, "BLOB_HTTP_LIMIT"); chunks.push(Buffer.from(next.value)); }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    },
    async (bytes) => execFileSync("git", ["hash-object", "-w", "--stdin"], { cwd: ROOT, input: bytes, encoding: "utf8",
      env: { ...env, GIT_NO_LAZY_FETCH: "1" }, timeout: 15000, maxBuffer: 1000, stdio: ["pipe", "pipe", "pipe"] }).trim());
  console.log(JSON.stringify({ status: "BASE_BLOBS_READY", count: prepared.length, first: prepared[0], second: prepared[1], deploymentAdmitted: false }));
}
function gitRaw(...args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", timeout: 15000,
    maxBuffer: 4 * 1024 * 1024, env: { ...process.env, GIT_NO_LAZY_FETCH: "1" }, stdio: ["ignore", "pipe", "pipe"] });
}
function git(...args) { return gitRaw(...args).trimEnd(); }
const digest = (s) => createHash("sha256").update(s.replace(/\r\n/g, "\n")).digest("hex");
function wiringDigest() {
  const rows = [...WIRING].sort().map((p) => [p, digest(readFileSync(resolve(ROOT, p), "utf8"))]);
  return createHash("sha256").update(JSON.stringify(rows)).digest("hex");
}
function verifyReceiptFields(receipt, context) {
  const sha40 = (v) => typeof v === "string" && /^[a-f0-9]{40}$/.test(v) && !/^0+$/.test(v);
  need(receipt && receipt.contract === "r3-response-label-source/1" && receipt.status === "SOURCE_SCOPE_PROVEN"
    && receipt.deploymentAdmitted === false && receipt.productFiles === 15 && receipt.wiringFiles === WIRING.length
    && receipt.priorHead === CORRECTIVE && receipt.priorCiRun === 41165808761
    && sha40(receipt.head) && sha40(receipt.source) && sha40(receipt.merge) && sha40(receipt.tree)
    && receipt.head === context.head && receipt.source === context.source && receipt.merge === context.merge
    && receipt.tree === context.tree && receipt.workflowSha === context.workflowSha
    && receipt.merge === context.workflowSha && /^[a-f0-9]{64}$/.test(receipt.wiringLfSha256 || "")
    && receipt.wiringLfSha256 === context.wiringLfSha256, "RECEIPT_HOLD");
  return true;
}
function verifyReceiptFile(file) {
  const env = process.env;
  need(env.GITHUB_EVENT_NAME === "pull_request" && env.GITHUB_REPOSITORY === REPO && env.GITHUB_EVENT_PATH, "RECEIPT_CONTEXT");
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  const receipt = JSON.parse(readFileSync(file, "utf8"));
  const head = event.pull_request?.head?.sha;
  need(git("show", "-s", "--format=%P", head) === CORRECTIVE
    && git("show", "-s", "--format=%P", CORRECTIVE) === METADATA, "RECEIPT_GRAPH");
  const source = git("show", "-s", "--format=%P", METADATA);
  verifyReceiptFields(receipt, { head, source, merge: git("rev-parse", "HEAD"),
    tree: git("rev-parse", "HEAD^{tree}"), workflowSha: env.GITHUB_WORKFLOW_SHA,
    wiringLfSha256: wiringDigest() });
  console.log(JSON.stringify({ ...receipt, receiptVerified: true }));
}

async function phoneGithubJson(path, token) {
  need(["pulls/228", "actions/runs/41166580662", "actions/runs/41166580662/jobs?per_page=100"].includes(path)
    && typeof token === "string" && token.length > 0, "PHONE_API_SCOPE");
  const response = await fetch(`https://api.github.com/repos/${REPO}/${path}`, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", Authorization: `Bearer ${token}` },
    redirect: "error", signal: AbortSignal.timeout(15000),
  });
  need(response.ok && response.body, "PHONE_API_HTTP");
  const reader = response.body.getReader(), chunks = []; let total = 0;
  for (;;) { const next = await reader.read(); if (next.done) break; total += next.value.length;
    need(total <= 1024 * 1024, "PHONE_API_LIMIT"); chunks.push(Buffer.from(next.value)); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function wrapPhoneWorkflow(previous) {
  const oldSparse = "            /app/admin/views/billing.js\n            /tests/r3-admin-response-label.test.js\n";
  const newSparse = "            /app/admin/views/billing.js\n" + ["app/admin/domain/coaches.js", "app/admin/domain/common.js", "app/admin/domain/values.js",
    "app/admin/actions/coach.js", "app/admin/data/common.js", "app/admin/data/schedule.js",
    "app/admin/forms/coach.js", "app/admin/views/settings.js", "tests/coach-staff-settlement-readback.test.js"]
    .map((p) => `            /${p}\n`).join("") + "            /tests/r3-admin-response-label.test.js\n";
  need(previous.split(oldSparse).length === 2, "PHONE_WORKFLOW_SPARSE");
  const anchor = "      - name: Admit exact response-label successor\n";
  const end = "          echo 'scoped=true' >> \"$GITHUB_OUTPUT\"\n";
  need(previous.split(anchor).length === 2 && previous.split(end).length === 2, "PHONE_WORKFLOW_ANCHOR");
  const oldBlock = previous.slice(previous.indexOf(anchor), previous.indexOf(end) + end.length);
  const expectedOld = `      - name: Admit exact response-label successor
        id: response_label
        if: github.event_name == 'pull_request' && github.head_ref == 'codex/tennisnote-r3-admin-response-label-dev571-20261031'
        run: |
          node scripts/collect_r3_response_label_pr.cjs --prepare-base
          if ! node scripts/collect_r3_response_label_pr.cjs > "$RUNNER_TEMP/r3-status-source-receipt.json"; then
            node scripts/collect_r3_response_label_pr.cjs --show-hold "$RUNNER_TEMP/r3-status-source-receipt.json"
            exit 1
          fi
          node scripts/collect_r3_response_label_pr.cjs --verify-receipt "$RUNNER_TEMP/r3-status-source-receipt.json"
          node --test --test-name-pattern='fourth layer' tests/r3-response-label-successor-core.test.cjs
          node --test --test-name-pattern='auth fourth|auth deploy' tests/r3-response-label-collector.test.cjs
          python tests/r3-response-label-deploy.test.py StatusDeploy.test_authenticated_fixed_github_path_and_no_fallback StatusDeploy.test_authenticated_http_errors_are_role_coded_and_redacted StatusDeploy.test_auth_fourth_layer_graph
          echo 'scoped=true' >> "$GITHUB_OUTPUT"
`;
  need(oldBlock === expectedOld, "PHONE_WORKFLOW_OLD");
  const phoneCommands = `          if [ "$(git show -s --format=%P "$PHONE_HEAD_SHA")" = "${PHONE_PREDECESSOR}" ]; then
            node scripts/collect_r3_response_label_pr.cjs --phone
            node --test --test-name-pattern='^phone successor' tests/r3-response-label-successor-core.test.cjs tests/r3-response-label-collector.test.cjs
            node --test --test-name-pattern='^blank existing phone' tests/coach-staff-settlement-readback.test.js
            python tests/r3-response-label-deploy.test.py StatusDeploy.test_phone_successor_scope StatusDeploy.test_phone_dispatch_rejects_wrong_context_before_external_access
          else
`;
  const priorCommands = expectedOld.split("        run: |\n")[1].replace("          echo 'scoped=true' >> \"$GITHUB_OUTPUT\"\n", "")
    .split("\n").filter(Boolean).map((line) => `  ${line}\n`).join("");
  const newBlock = expectedOld.split("        run: |\n")[0]
    + "        env:\n          STATUS_GITHUB_TOKEN: ${{ github.token }}\n          PHONE_HEAD_SHA: ${{ github.event.pull_request.head.sha }}\n"
    + "        run: |\n" + phoneCommands + priorCommands + "          fi\n" + end;
  return previous.replace(oldSparse, newSparse).replace(oldBlock, newBlock);
}

async function collectPhone() {
  const env = process.env;
  need(git("status", "--porcelain", "--untracked-files=all") === "" && git("diff", "--cached", "--name-only") === "", "DIRTY_WORKTREE");
  need(env.GITHUB_EVENT_PATH && env.GITHUB_RUN_ATTEMPT === "1", "PHONE_EVENT");
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  const [pr, priorRun, priorJobs] = await Promise.all([
    phoneGithubJson("pulls/228", env.STATUS_GITHUB_TOKEN),
    phoneGithubJson("actions/runs/41166580662", env.STATUS_GITHUB_TOKEN),
    phoneGithubJson("actions/runs/41166580662/jobs?per_page=100", env.STATUS_GITHUB_TOKEN),
  ]);
  validatePhonePriorRun(priorRun); validatePhonePriorJobs(priorJobs);
  const head = pr.head?.sha, merge = git("rev-parse", "HEAD");
  need(pr.state === "open" && pr.number === 228 && event.number === 228 && event.repository?.full_name === REPO
    && event.pull_request?.head?.sha === head && event.pull_request?.base?.sha === pr.base?.sha, "PHONE_PR_DRIFT");
  validatePhonePrGraph({ event: env.GITHUB_EVENT_NAME, repo: env.GITHUB_REPOSITORY,
    baseRepo: pr.base?.repo?.full_name, headRepo: pr.head?.repo?.full_name,
    base: pr.base?.sha, baseRef: pr.base?.ref, headRef: pr.head?.ref, attempt: Number(env.GITHUB_RUN_ATTEMPT),
    number: pr.number, ref: env.GITHUB_REF, workflow: env.GITHUB_WORKFLOW, workflowRef: env.GITHUB_WORKFLOW_REF,
    head, merge, headTree: git("rev-parse", `${head}^{tree}`), mergeTree: git("rev-parse", `${merge}^{tree}`),
    headParents: git("show", "-s", "--format=%P", head).split(" ").filter(Boolean),
    mergeParents: git("show", "-s", "--format=%P", merge).split(" ").filter(Boolean),
    githubSha: env.GITHUB_SHA, workflowSha: env.GITHUB_WORKFLOW_SHA, clean: true, indexClean: true });
  need(gitRaw("show", `${head}:.github/workflows/tennisnote-public-ci.yml`).replace(/\r\n/g, "\n")
    === wrapPhoneWorkflow(gitRaw("show", `${PHONE_PREDECESSOR}:.github/workflows/tennisnote-public-ci.yml`).replace(/\r\n/g, "\n")), "PHONE_WORKFLOW_INVERSE");
  const rows = git("diff", "--no-renames", "--name-status", PHONE_PREDECESSOR, head).split("\n").filter(Boolean).map((x) => x.split("\t"));
  validatePhoneDeltaRows(rows, PHONE_WIRING);
  const hashes = {};
  for (const [, p] of rows) {
    need(git("ls-tree", "--format=%(objectmode)", head, "--", p) === "100644", "PHONE_MODE");
    let current = ROOT;
    for (const part of p.split("/")) { current = resolve(current, part); need(!lstatSync(current).isSymbolicLink(), "PHONE_SYMLINK"); }
    const text = readFileSync(current, "utf8");
    need(text.replace(/\r\n/g, "\n") === gitRaw("show", `${head}:${p}`).replace(/\r\n/g, "\n"), "PHONE_FILE_DRIFT");
    if (Object.hasOwn(PHONE_PIN, p)) hashes[p] = digest(text);
  }
  const release = JSON.parse(readFileSync(resolve(ROOT, "app/release.json"), "utf8"));
  const member = readFileSync(resolve(ROOT, "app/tennis-note-member-app/service-worker.js"), "utf8");
  const coach = readFileSync(resolve(ROOT, "app/tennis-note-coach-app/service-worker.js"), "utf8");
  const number = (text, prefix) => Number(text.match(new RegExp(`const CACHE_NAME = "${prefix}(\\d+)"`))?.[1]);
  validatePhoneLocalScope({ predecessor: PHONE_PREDECESSOR, branch: BRANCH, environment: "development",
    projectFingerprint: PROJECT, rollbackCommit: PHONE_PREDECESSOR, version: release.version,
    releaseId: release.releaseId, memberCache: number(member, "tennis-note-member-pwa-v"),
    coachCache: number(coach, "tennis-note-coach-mode-v"), nativeBuildChanged: false, databaseAction: false,
    paths: Object.keys(hashes), hashes });
  need(git("status", "--porcelain", "--untracked-files=all") === "" && git("rev-parse", "HEAD") === merge, "POST_DRIFT");
  console.log(JSON.stringify({ contract: "r3-phone-successor-source/1", status: "SOURCE_SCOPE_PROVEN",
    head, merge, tree: git("rev-parse", `${head}^{tree}`), predecessor: PHONE_PREDECESSOR,
    priorCiRun: 41166580662, productFiles: Object.keys(PHONE_PIN).length, wiringFiles: PHONE_WIRING.length,
    deploymentAdmitted: false }));
}
async function collect() {
  // Check the actual index/worktree before event/API reads; local dirty candidates must not pass.
  need(git("status", "--porcelain", "--untracked-files=all") === "", "DIRTY_WORKTREE");
  need(git("diff", "--cached", "--name-only") === "", "DIRTY_INDEX");
  const env = process.env;
  need(env.GITHUB_EVENT_NAME === "pull_request" && env.GITHUB_REPOSITORY === REPO
    && env.GITHUB_EVENT_PATH && env.GITHUB_RUN_ATTEMPT === "1", "EVENT_CONTEXT");
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  const number = event.number;
  need(Number.isSafeInteger(number) && number > 0 && event.repository?.full_name === REPO
    && event.pull_request?.number === number, "PR_CONTEXT");
  const response = await fetch(`https://api.github.com/repos/${REPO}/pulls/${number}`, {
    headers: { Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28" }, redirect: "error", signal: AbortSignal.timeout(15000),
  });
  need(response.ok && response.body, "PR_READ_FAILED");
  const reader = response.body.getReader(), chunks = [];
  let size = 0;
  for (;;) {
    const next = await reader.read();
    if (next.done) break;
    size += next.value.length;
    need(size <= 1024 * 1024, "PR_READ_LIMIT");
    chunks.push(Buffer.from(next.value));
  }
  const pr = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  const head = pr.head?.sha, merge = git("rev-parse", "HEAD");
  const parents = git("show", "-s", "--format=%P", head).split(" ").filter(Boolean);
  need(parents.length === 1 && parents[0] === CORRECTIVE, "SOURCE_PARENT");
  const source = SOURCE, metadata = METADATA;
  const s = { event: env.GITHUB_EVENT_NAME, repo: env.GITHUB_REPOSITORY,
    baseRepo: pr.base?.repo?.full_name, headRepo: pr.head?.repo?.full_name,
    base: pr.base?.sha, baseRef: pr.base?.ref, headRef: pr.head?.ref, attempt: Number(env.GITHUB_RUN_ATTEMPT),
    number, ref: env.GITHUB_REF, workflow: env.GITHUB_WORKFLOW, workflowRef: env.GITHUB_WORKFLOW_REF,
    head, source, metadata, corrective: CORRECTIVE, merge, headTree: git("rev-parse", `${head}^{tree}`), mergeTree: git("rev-parse", `${merge}^{tree}`),
    headParents: parents, correctiveParents: git("show", "-s", "--format=%P", CORRECTIVE).split(" ").filter(Boolean), metadataParents: git("show", "-s", "--format=%P", metadata).split(" ").filter(Boolean),
    sourceParents: git("show", "-s", "--format=%P", source).split(" ").filter(Boolean),
    mergeParents: git("show", "-s", "--format=%P", merge).split(" ").filter(Boolean),
    githubSha: env.GITHUB_SHA, workflowSha: env.GITHUB_WORKFLOW_SHA, clean: true, indexClean: true };
  need(pr.state === "open" && pr.number === number && pr.base?.sha === event.pull_request?.base?.sha
    && pr.head?.sha === event.pull_request?.head?.sha && pr.base?.ref === BASE_REF
    && pr.head?.ref === BRANCH && pr.base?.sha === BASE, "PR_DRIFT");
  validatePrBoundary(s);
  const workflow = gitRaw("show", `${head}:.github/workflows/tennisnote-public-ci.yml`).replace(/\r\n/g, "\n");
  const previousWorkflow = gitRaw("show", `${BASE}:.github/workflows/tennisnote-public-ci.yml`).replace(/\r\n/g, "\n");
  need(workflow === wrapWorkflow(previousWorkflow), "WORKFLOW_INVERSE");
  const deployPath = ".github/workflows/deploy-cloudflare-pages-dev.yml";
  need(gitRaw("show", `${head}:${deployPath}`).replace(/\r\n/g, "\n")
    === wrapDeployWorkflow(gitRaw("show", `${BASE}:${deployPath}`).replace(/\r\n/g, "\n")), "DEPLOY_WORKFLOW_INVERSE");
  const allowed = [...Object.keys(PIN), ...WIRING].sort();
  const changes = git("diff", "--no-renames", "--name-status", BASE, head).split("\n").filter(Boolean).map((x) => x.split("\t"));
  need(changes.length === allowed.length && new Set(changes.map((x) => x[1])).size === allowed.length
    && changes.map((x) => x[1]).sort().every((p, i) => p === allowed[i]), "PATH_SCOPE");
  const sourcePaths = allowed.filter((p) => !META.includes(p)).sort();
  const layer = (a, b, paths, status) => {
    const rows = git("diff", "--no-renames", "--name-status", a, b).split("\n").filter(Boolean).map((x) => x.split("\t"));
    validateLayerRows(rows, paths, status);
  };
  layer(BASE, source, sourcePaths, expectedFileStatus);
  layer(source, metadata, META, () => "M");
  layer(metadata, CORRECTIVE, FIX, () => "M");
  layer(CORRECTIVE, head, AUTH_FIX, () => "M");
  for (const [status, p] of changes) {
    need(status === expectedFileStatus(p) && git("ls-tree", "--format=%(objectmode)", head, "--", p) === "100644"
      && (!sourcePaths.includes(p) || git("ls-tree", "--format=%(objectmode)", source, "--", p) === "100644"), "FILE_MODE");
    let current = ROOT;
    for (const part of p.split("/")) { current = resolve(current, part); need(!lstatSync(current).isSymbolicLink(), "SYMLINK"); }
    const text = readFileSync(current, "utf8");
    need(text.replace(/\r\n/g, "\n") === gitRaw("show", `${head}:${p}`).replace(/\r\n/g, "\n"), "FILE_DRIFT");
    if (Object.hasOwn(PIN, p)) need(digest(text) === PIN[p], "PRODUCT_PIN");
  }
  need(git("status", "--porcelain", "--untracked-files=all") === ""
    && git("diff", "--cached", "--name-only") === "" && git("rev-parse", "HEAD") === merge, "POST_DRIFT");
  console.log(JSON.stringify({ contract: "r3-response-label-source/1", status: "SOURCE_SCOPE_PROVEN",
    head, source, merge, tree: s.headTree, workflowSha: env.GITHUB_WORKFLOW_SHA,
    priorHead: CORRECTIVE, priorCiRun: 41165808761,
    wiringLfSha256: wiringDigest(), productFiles: Object.keys(PIN).length,
    wiringFiles: WIRING.length, productionWrite: false, deploymentAdmitted: false }));
}
if (require.main === module) (async () => {
  if (process.argv.length === 3 && process.argv[2] === "--phone") return collectPhone();
  if (process.argv.length === 4 && process.argv[2] === "--verify-receipt") return verifyReceiptFile(process.argv[3]);
  if (process.argv.length === 4 && process.argv[2] === "--show-hold") {
    let reason = "COLLECTION_HOLD";
    try { const receipt = JSON.parse(readFileSync(process.argv[3], "utf8")); if (receipt?.status === "HOLD") reason = receipt.reason; } catch {}
    console.log(JSON.stringify(safeHold(Error(reason))));
    return;
  }
  if (process.argv.length === 3 && process.argv[2] === "--prepare-base") return prepareBaseBlobs();
  need(process.argv.length === 2, "ARGUMENT_HOLD");
  return collect();
})().catch((error) => {
  console.log(JSON.stringify(safeHold(error)));
  process.exitCode = 1;
});
module.exports = { wrapWorkflow, wrapDeployWorkflow, wrapPhoneWorkflow, validateLayerRows, verifyReceiptFields, decodePinnedBlob, ensurePinnedBlobs, safeHold, FIX, AUTH_FIX, BASE_BLOBS, PHONE_WIRING, phoneGithubJson };
