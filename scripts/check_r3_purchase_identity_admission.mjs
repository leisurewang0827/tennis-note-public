// DEV564 후속 후보만 승인한다. 561/562/563 검사와 역사적 봉인은 수정하지 않는다.
import { createHash } from "node:crypto";
import { readFileSync, appendFileSync, lstatSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve } from "node:path";
export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const BASE = "b18de04ee6e883ecf4f530aee678732fb5e0d783";
export const BASE_TREE = "bcc1512c7989ae052d09f4d309485b66d4308e91";
export const TARGET = [BASE, BASE_TREE];
export const QA_BASE_BRANCH = "codex/tennisnote-r3-display-dev563-20261028";
export const REPOSITORY = "leisurewang0827/tennis-note-public";
export const BRANCH = "codex/tennisnote-r3-registration-dev564-public-20261028";
export const SELF = "scripts/check_r3_purchase_identity_admission.mjs";
export const TEST = "tests/r3-purchase-identity-admission.test.mjs";
export const DEV = "scripts/check_r3_purchase_identity_dev.py";
export const DEV_TEST = "tests/r3-purchase-identity-dev.test.py";
export const IDENTITY_TEST = "tests/admin-purchase-identity-wiring.test.js";
export const WORKFLOWS = [".github/workflows/tennisnote-public-ci.yml", ".github/workflows/deploy-cloudflare-pages-dev.yml"];
export const WORKFLOW_NAMES = ["Tennis Note Public PWA CI", "Deploy Tennis Note development sites"];
export const PRIVATE_SOURCE = Object.freeze({base: "d33a687b120e85f8dbb77d8b28fc4a040a3ea61c", tree: "00cd817ff13642092d92c5562f06b88540d57334", path: "90-Dashboard/tennis-note-prototype/app.js", lfSha256: "da6041ac9560668b4e3de0613a79adbdbb7b47bb8cf45b514843cefdc2a80d08"});
export const PRODUCTS = Object.freeze({
  "app/admin/actions/member.js": "d7a468285b07c022f1bb8dbe0669dbe43ba7c5ab67db1c9aac115f2125982aa4",
  "app/admin/ui/member.js": "0bc3fc4b8816a9e645b5e51db8b7fa84d16a84c5880872bb27ade5bcf975dc25",
  "app/admin/domain/members.js": "bd9b39bff08186ec37dd1b5f0af27ab34cafbb7a68859b9f5e9c8fa0afb8db54",
  [IDENTITY_TEST]: "6b9ade7ae5299197038d4a5a17bc4b4b5369fcdfee0a06a073e05f05cb5725f9",
});
export const CONNECTION_PINS = { [TEST]: "ede331295986313060d39bb22baebd1069e6c9a498a3a56848e94d4c9335f17c", [DEV]: "06d840a838c5325fbd4b3d5cbfe77568e56f84a78be151bf5186c5c6ddee3fc1", [DEV_TEST]: "d7031a74199f4b18f0be51711608e13ab3b3b66336921ed1df1beaea174a5f8a" };
export const SOURCE_SEAL = "94cddec8fcac461efdee0d92a3a2d4f8eb7fbc5206239f1e1a849ade82d7e392";
export const METADATA = ["app/admin/index.html", "app/release.json", "app/shared/tennisnote-release.js", "app/tennis-note-coach-app/app.js", "app/tennis-note-coach-app/domain/coaches.js", "app/tennis-note-coach-app/forms/common.js", "app/tennis-note-coach-app/index.html", "app/tennis-note-coach-app/service-worker.js", "app/tennis-note-member-app/app.js", "app/tennis-note-member-app/forms/common.js", "app/tennis-note-member-app/index.html", "app/tennis-note-member-app/service-worker.js", "app/tennis-note-member-app/ui/screens.js"];
export const RELEASE = Object.freeze({version: "1.0.564", appSurfaceVersion: "1.0.564", releaseId: "2026.10.28.03", deployedAt: "2026-10-28T14:25:42+09:00", memberCache: "tennis-note-member-pwa-v597", coachCache: "tennis-note-coach-mode-v570"});
export const NEW_PATHS = [SELF, TEST, DEV, DEV_TEST, IDENTITY_TEST];
export const PATHS = [...Object.keys(PRODUCTS), ...METADATA, SELF, TEST, DEV, DEV_TEST, ...WORKFLOWS].sort();
export const SOURCE_PATHS = PATHS.filter(p => !METADATA.includes(p));
export const PRESERVED = {
  "app/admin/actions/billing.js": "b9552a836fcedfe904ec08b364c04a3afc722cdb1c423619df3fa53f18b33d47",
  "tests/r3-settlement-preview-errors.test.js": "cee1a42b2885363aea120fa443295f7fb2580c2e6da1c08d83d86e786b782fc1",
};
export const lf = s => String(s).replace(/\r\n/g, "\n");
export const hash = s => createHash("sha256").update(s).digest("hex");
export const need = (ok, code) => { if (!ok) throw Error(code); };
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
export const once = (s, a, b) => { need(s.split(a).length === 2, "ANCHOR"); return s.replace(a, b); };
export const seal = s => hash(lf(s).replace(/export const SOURCE_SEAL = "[^"]+";/, 'export const SOURCE_SEAL = "PENDING";'));
export function expectedMetadata(name, source) {
  let s = lf(source);
  if (name === "app/release.json" || name === "app/shared/tennisnote-release.js") {
    for (const k of ["version", "appSurfaceVersion", "releaseId", "deployedAt"]) {
      const re = name.endsWith(".json") ? new RegExp('("'+k+'":\\s*")[^"]+(")', "g") : new RegExp('^(    '+k+': ")[^"]+(")', "gm");
      need([...s.matchAll(re)].length === 1, "RELEASE_ANCHOR");
      s = s.replace(re, (_, a, b) => a + RELEASE[k] + b);
    }
  } else {
    s = s.replace(/([^"'\s()]*)\?v=(\d+\.\d+\.\d+)/g, (m, url, v) => {
      if (url.includes("://") || url.includes("/vendor/")) return m;
      need(v === "1.0.563", "STALE_QUERY"); return url + "?v=" + RELEASE.version;
    });
    if (name.endsWith(".js")) s = s.replace(/(\bv:\s*"|\|\|\s*")1\.0\.563(")/g, (_, a, b) => a + RELEASE.version + b);
    if (name.endsWith("/service-worker.js")) {
      const re = /const CACHE_NAME = "[a-z-]+-v\d+";/g;
      need([...s.matchAll(re)].length === 1, "CACHE_ANCHOR");
      s = s.replace(re, 'const CACHE_NAME = "' + RELEASE[name.includes("member-app") ? "memberCache" : "coachCache"] + '";');
    }
  }
  need(s !== lf(source), "EMPTY_METADATA"); return s;
}
export function expectedWorkflow(name, source) {
  let s = lf(source);
  if (name === WORKFLOWS[0]) {
    const anchor = '      - "scripts/check_r3_display*"';
    need(s.split(anchor).length === 3, "TWO_PATH_FILTERS");
    s = s.replaceAll(anchor, anchor + '\n      - "scripts/check_r3_purchase_identity*"');
    s = once(s, "node scripts/check_r3_display_source_admission.mjs --ci-route", "node " + SELF + " --ci-route");
    s = once(s, "if: steps.display.outputs.scoped == 'true'", "if: steps.display.outputs.display_only == 'true'");
    s = once(s, "      # 고정 운영 기준 blob", "      - name: DEV564 purchase identity and successor linkage only\n        if: steps.display.outputs.purchase_identity_only == 'true'\n        run: |\n          node --test " + TEST + " " + IDENTITY_TEST + "\n          python -B " + DEV_TEST + "\n      # 고정 운영 기준 blob");
  } else {
    need(name === WORKFLOWS[1], "WORKFLOW");
    s = once(s, "    environment: development\n", "    environment: development\n    timeout-minutes: 10\n");
    const begin = "      - name: Admit exact DEV563 child source\n", end = "      - name: Build isolated development sites\n";
    need(s.split(begin).length === 2 && s.split(end).length === 2, "DEPLOY_SOURCE_ANCHORS");
    s = once(s, s.slice(s.indexOf(begin), s.indexOf(end)), "      - name: Admit exact DEV564 manual successor only\n        run: node " + SELF + " --dev-source\n\n");
    const live = "      - name: Prevent development release rollback for exact display source\n", deploy = "      - name: Deploy member development PWA\n";
    need(s.split(live).length === 2 && s.split(deploy).length === 2, "DEPLOY_RUNTIME_ANCHORS");
    s = once(s, s.slice(s.indexOf(live), s.indexOf(deploy)), "      - name: Verify DEV564 runtime assets and exact rollback target\n        run: python -B " + DEV + "\n\n");
  }
  return s;
}
export const git = (...args) => execFileSync("git", args, {cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000, maxBuffer: 8 * 1024 * 1024}).trimEnd();
const allowed = name => need(PATHS.includes(name), "READ_OUTSIDE_SCOPE");
export const IO = {
  tree: ref => git("rev-parse", ref + "^{tree}"),
  parents: ref => git("show", "-s", "--format=%P", ref).split(" ").filter(Boolean),
  changes: (from, to) => git("diff", "--no-renames", "--name-status", from, to).split("\n").filter(Boolean).map(s => s.split("\t")),
  blob: (ref, name) => { allowed(name); return lf(execFileSync("git", ["show", ref + ":" + name], {cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000, maxBuffer: 8 * 1024 * 1024})); },
  mode: (ref, name) => { allowed(name); return git("ls-tree", "--format=%(objectmode)", ref, "--", name); },
};
export function proveTree(ref, io = IO) {
  need(io.tree(BASE) === BASE_TREE && io.tree(TARGET[0]) === TARGET[1], "BASE_TREE");
  const parents = io.parents(ref), source = parents[0];
  need(/^[a-f0-9]{40}$/.test(ref) && parents.length === 1 && /^[a-f0-9]{40}$/.test(source || "") && source !== BASE && source !== ref && ref !== BASE && same(io.parents(source), [BASE]), "TWO_LAYER_PARENTS");
  // BASE→C(기능10)→D(메타데이터13)의 모든 여집합을 경로 단계에서 먼저 잠근다.
  const layers = [[BASE, source, SOURCE_PATHS], [source, ref, [...METADATA].sort()], [BASE, ref, PATHS]];
  for (const [from, to, paths] of layers) {
    const delta = io.changes(from, to);
    need(same(delta.map(r => r[1]).sort(), paths), "EXACT_SCOPE");
    for (const [kind, name] of delta) need(kind === (from === BASE && NEW_PATHS.includes(name) ? "A" : "M"), "FILE_KIND");
  }
  for (const name of PATHS) need(io.mode(source, name) === "100644" && io.mode(ref, name) === "100644", "FILE_KIND");
  for (const name of SOURCE_PATHS) {
    const value = io.blob(source, name);
    if (name === SELF) need(seal(value) === SOURCE_SEAL, "SOURCE_SEAL");
    else if (PRODUCTS[name] || CONNECTION_PINS[name]) need(hash(value) === (PRODUCTS[name] || CONNECTION_PINS[name]), "CONTENT_PIN");
    else if (WORKFLOWS.includes(name)) need(value === expectedWorkflow(name, io.blob(BASE, name)), "WORKFLOW_BYTES");
    else need(false, "UNKNOWN_SOURCE");
    need(io.blob(ref, name) === value, "SOURCE_BYTES");
  }
  for (const name of METADATA) {
    const baseline = io.blob(BASE, name);
    need(io.blob(source, name) === baseline, "EARLY_METADATA");
    need(io.blob(ref, name) === expectedMetadata(name, baseline), "METADATA_BYTES");
  }
  const sourceTree = io.tree(source), metadataTree = io.tree(ref);
  need(/^[a-f0-9]{40}$/.test(sourceTree) && /^[a-f0-9]{40}$/.test(metadataTree) && sourceTree !== metadataTree && sourceTree !== BASE_TREE && metadataTree !== BASE_TREE, "LAYER_TREES");
  return {contract: "r3-purchase-identity-source/1", tree: metadataTree, base: BASE, layers: {count: 2, sourceCommit: source, metadataCommit: ref, sourceTree, metadataTree}, version: RELEASE.version, release: RELEASE, privateSource: PRIVATE_SOURCE, productHashes: PRODUCTS, environment: "development", reusedFocusedCount: 60, databaseRuns: 0};
}
export function proveEvent(c, io = IO) {
  need(c.repo === REPOSITORY && c.attempt === "1" && /^[a-f0-9]{40}$/.test(c.head || ""), "EVENT_IDENTITY");
  need(WORKFLOW_NAMES.includes(c.workflow), "WORKFLOW_NAME");
  const file = WORKFLOWS[WORKFLOW_NAMES.indexOf(c.workflow)];
  need(c.workflowRef === REPOSITORY + "/" + file + "@" + c.ref && c.workflowSha === c.sha, "WORKFLOW_CONTEXT");
  if (c.event === "pull_request") {
    need(c.workflow === WORKFLOW_NAMES[0] && c.target === QA_BASE_BRANCH && c.base === TARGET[0] && c.headRepo === REPOSITORY && c.headRef === BRANCH && /^refs\/pull\/[1-9]\d*\/merge$/.test(c.ref), "PR_CONTEXT");
    need(c.checkout === c.sha && same(io.parents(c.sha), [c.base, c.head]), "PR_MERGE_PARENTS");
  } else {
    need(c.event === "workflow_dispatch" && c.workflow === WORKFLOW_NAMES[1] && c.ref === "refs/heads/" + BRANCH && c.refType === "branch" && c.input === c.head && c.sha === c.head && c.checkout === c.head, "MANUAL_DEV_ONLY");
  }
  const proof = proveTree(c.head, io);
  need(io.tree(c.checkout) === proof.tree, "MERGE_PAYLOAD");
  return {...proof, head: c.head, checkout: c.checkout, event: c.event, ref: c.ref, admissionRoute: c.event === "workflow_dispatch" ? "dev564-manual" : "dev564-qa-pr"};
}
export function context(env, event, checkout) {
  const pr = event.pull_request;
  return {repo: env.GITHUB_REPOSITORY, attempt: env.GITHUB_RUN_ATTEMPT, event: env.GITHUB_EVENT_NAME, workflow: env.GITHUB_WORKFLOW, workflowRef: env.GITHUB_WORKFLOW_REF, workflowSha: env.GITHUB_WORKFLOW_SHA, sha: env.GITHUB_SHA, ref: env.GITHUB_REF, refType: env.GITHUB_REF_TYPE, input: event.inputs?.candidate_sha, checkout, head: pr?.head?.sha || env.GITHUB_SHA, headRepo: pr?.head?.repo?.full_name, headRef: pr?.head?.ref, base: pr?.base?.sha, target: pr?.base?.ref};
}
export function regularPath(name, stat = lstatSync) {
  allowed(name);
  let path = ROOT;
  for (const part of name.split("/")) { path = resolve(path, part); need(!stat(path).isSymbolicLink(), "SYMLINK"); }
  need(stat(path).isFile(), "REGULAR_FILE");
  return path;
}
function disk(name) { return lf(readFileSync(regularPath(name), "utf8")); }
export function verifyCheckout(c, host = {status: () => git("status", "--porcelain", "--untracked-files=all"), io: IO, read: disk}) {
  need(host.status() === "", "HOSTED_CLEAN");
  const proof = proveEvent(c, host.io);
  for (const p of PATHS) need(host.read(p) === host.io.blob(c.checkout, p), "WORKTREE_BYTES");
  return proof;
}
export function localOverlay() {
  need(git("rev-parse", "HEAD") === BASE && git("diff", "--cached", "--name-only") === "", "LOCAL_BASE_INDEX");
  const dirty = [...git("diff", "--name-only").split("\n"), ...git("ls-files", "--others", "--exclude-standard").split("\n")].filter(Boolean);
  need(same(dirty.filter(p => !Object.hasOwn(PRESERVED, p)).sort(), PATHS), "LOCAL_SCOPE");
  for (const [p, h] of Object.entries(PRESERVED)) need(hash(readFileSync(resolve(ROOT, p))) === h, "PRESERVED_DIRTY");
  const source = "c".repeat(40), release = "d".repeat(40);
  const io = {...IO, tree: ref => ref === source ? "e".repeat(40) : ref === release ? "f".repeat(40) : IO.tree(ref), parents: ref => ref === release ? [source] : ref === source ? [BASE] : IO.parents(ref),
    changes: (from, to) => (to === source ? SOURCE_PATHS : from === source ? [...METADATA].sort() : PATHS).map(p => [from === BASE && NEW_PATHS.includes(p) ? "A" : "M", p]),
    mode: () => "100644", blob: (ref, p) => ref === release || (ref === source && SOURCE_PATHS.includes(p)) ? disk(p) : IO.blob(BASE, p)};
  return {...proveTree(release, io), tree: "UNCOMMITTED", layers: {count: 2, sourceCommit: null, metadataCommit: null, sourceTree: null, metadataTree: null}, candidateCommit: null, status: "LOCAL_ONLY"};
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const mode = process.argv[2]; need(["--local", "--ci-route", "--dev-source"].includes(mode), "MODE");
    const proof = mode === "--local" ? localOverlay() : verifyCheckout(context(process.env, JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, "utf8")), git("rev-parse", "HEAD")));
    if (mode === "--dev-source") need(proof.admissionRoute === "dev564-manual", "DEV_ONLY");
    if (mode === "--ci-route") { need(proof.event === "pull_request", "CI_PR_ONLY"); appendFileSync(process.env.GITHUB_OUTPUT, "scoped=true\npurchase_identity_only=true\n"); }
    console.log(JSON.stringify(proof));
  } catch { console.error("R3_PURCHASE_IDENTITY_HOLD"); process.exitCode = 2; }
}
