"use strict";

// Read-only facts only: never emits a CI skip, deployment permit, credentials or raw paths.
const { execFileSync } = require("node:child_process");
const { readFileSync, lstatSync } = require("node:fs");
const { createHash } = require("node:crypto");
const { resolve } = require("node:path");
const { validatePrBoundary, PIN, META, BASE, BRANCH } = require("./check_r3_response_label_successor.cjs");
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
  return prefix + marker + INTRO + wrapped;
}
function wrapDeployWorkflow(base) {
  const marker = "      - name: Admit exact manual R3 candidate\n";
  need(base.split(marker).length === 2, "DEPLOY_WORKFLOW_BASE");
  return base.replace(marker, "      - uses: actions/setup-node@v7\n        with:\n          node-version: \"22\"\n\n" + marker);
}
const need = (value, code) => { if (!value) throw Error(code); };
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
  const source = git("show", "-s", "--format=%P", head);
  verifyReceiptFields(receipt, { head, source, merge: git("rev-parse", "HEAD"),
    tree: git("rev-parse", "HEAD^{tree}"), workflowSha: env.GITHUB_WORKFLOW_SHA,
    wiringLfSha256: wiringDigest() });
  console.log(JSON.stringify({ ...receipt, receiptVerified: true }));
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
  need(parents.length === 1 && /^[a-f0-9]{40}$/.test(parents[0]), "SOURCE_PARENT");
  const source = parents[0];
  const s = { event: env.GITHUB_EVENT_NAME, repo: env.GITHUB_REPOSITORY,
    baseRepo: pr.base?.repo?.full_name, headRepo: pr.head?.repo?.full_name,
    base: pr.base?.sha, baseRef: pr.base?.ref, headRef: pr.head?.ref, attempt: Number(env.GITHUB_RUN_ATTEMPT),
    number, ref: env.GITHUB_REF, workflow: env.GITHUB_WORKFLOW, workflowRef: env.GITHUB_WORKFLOW_REF,
    head, source, merge, headTree: git("rev-parse", `${head}^{tree}`), mergeTree: git("rev-parse", `${merge}^{tree}`),
    headParents: parents, sourceParents: git("show", "-s", "--format=%P", source).split(" ").filter(Boolean),
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
  layer(source, head, META, () => "M");
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
    wiringLfSha256: wiringDigest(), productFiles: Object.keys(PIN).length,
    wiringFiles: WIRING.length, productionWrite: false, deploymentAdmitted: false }));
}
if (require.main === module) (async () => {
  if (process.argv.length === 4 && process.argv[2] === "--verify-receipt") return verifyReceiptFile(process.argv[3]);
  need(process.argv.length === 2, "ARGUMENT_HOLD");
  return collect();
})().catch((error) => {
  const safe = /^[A-Z_]+$/.test(String(error?.message || "")) ? error.message : "COLLECTION_HOLD";
  console.log(JSON.stringify({ status: "HOLD", reason: safe, deploymentAdmitted: false }));
  process.exitCode = 1;
});
module.exports = { wrapWorkflow, wrapDeployWorkflow, validateLayerRows, verifyReceiptFields };
