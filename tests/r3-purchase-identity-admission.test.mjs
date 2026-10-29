import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { runInNewContext } from "node:vm";
import { spawnSync } from "node:child_process";
import * as a from "../scripts/check_r3_purchase_identity_admission.mjs";

// 새 후속 경계만 검사한다. 과거60/DB/역사적 검사/전체 파일 스캔은 실행하지 않는다.
const head = "1".repeat(40), merge = "2".repeat(40), source = "3".repeat(40);
const sourceTree = "4".repeat(40), releaseTree = "5".repeat(40);
const read = p => a.lf(readFileSync(resolve(a.ROOT, p), "utf8"));
const productionOnly=process.env.R3_PRODUCTION_SELECTED==='1' || process.env.R3_LEGACY_MONTHLY_SELECTED==='1';
function productionFixture(){
 const f=a.productionFixture(),real=a.productionIO(f),toolPaths=[a.SELF,...Object.keys(a.PRODUCTION_TOOL_PINS)];
 const paths=[...f.rows.map(r=>r.path),...toolPaths].sort(),bodies={};
 for(const r of f.rows){const base=real.blob(f.base,r.path);bodies[r.path]=f.metadataPaths.includes(r.path)?a.expectedMetadata(r.path,r.semantic?a.once(base,r.semantic.before,r.semantic.after):base,f.release,'1.0.558'):real.blob(f.source,r.path);}
 for(const p of toolPaths)bodies[p]=p===a.PRODUCTION_HTTP_HELPER?a.productionHelperSource(real,f):read(p);
 const io={...real,parents:r=>r===head?[f.base]:r===merge?[f.base,head]:real.parents(r),tree:r=>[head,merge].includes(r)?releaseTree:real.tree(r),
  changes:()=>paths.map(p=>[real.mode(f.base,p)===''?'A':'M',p]),mode:(r,p)=>[head,merge].includes(r)?'100644':real.mode(r,p),blob:(r,p)=>[head,merge].includes(r)?bodies[p]:real.blob(r,p)};
 const c={repo:a.REPOSITORY,attempt:'1',event:'pull_request',workflow:'Tennis Note Public PWA CI',workflowRef:a.REPOSITORY+'/.github/workflows/tennisnote-public-ci.yml@refs/pull/999/merge',workflowSha:merge,sha:merge,ref:'refs/pull/999/merge',refType:'branch',head,checkout:merge,target:'main',base:f.base,headRepo:a.REPOSITORY,headRef:f.branch};
 return {f,io,c,bodies,paths};
}
test('PROD559: exact committed selection and official metadata bytes',()=>{
 const {f,io}=productionFixture();const result=a.proveProductionTree(head,io,f);
 assert.equal(result.paths,36);assert.equal(result.version,'1.0.559');assert.equal(result.dbApply,0);
 assert.equal(f.rows.length,27);assert.equal(f.rows.find(r=>r.path==='app/admin/actions/member.js').sourceLfSha256,a.CHECKOUT_PRODUCTS['app/admin/actions/member.js']);
 assert.ok(f.rows.every(r=>r.path.startsWith('app/')));
});
test('PROD559: main PR and exact squash accepted, DEV fork rerun dispatch denied',()=>{
 const {f,io,c}=productionFixture();assert.equal(a.proveProductionEvent(c,io,f).environment,'production');
 const main={...c,event:'push',ref:'refs/heads/main',head,sha:head,checkout:head,workflowSha:head,workflowRef:a.REPOSITORY+'/.github/workflows/tennisnote-public-ci.yml@refs/heads/main'};
 assert.equal(a.proveProductionEvent(main,io,f).head,head);
 for(const patch of [{target:'dev'},{headRepo:'other/repo'},{headRef:a.BRANCH},{attempt:'2'},{workflowSha:head},{event:'workflow_dispatch'},{base:a.BASE}])assert.throws(()=>a.proveProductionEvent({...c,...patch},io,f));
});
test('PROD559: unknown path dirty source and one-byte admission drift rejected',()=>{
 const {f,io}=productionFixture();
 assert.throws(()=>a.proveProductionTree(head,{...io,changes:()=>[...io.changes(),'M\tother'.split('\t')]},f));
 assert.throws(()=>a.proveProductionTree(head,{...io,blob:(r,p)=>io.blob(r,p)+(r===head?'x':'')},f));
 assert.throws(()=>a.proveProductionTree(head,{...io,mode:(r,p)=>r===head?'120000':io.mode(r,p)},f));
 assert.throws(()=>a.proveProductionTree(head,io,{...f,source:a.CHECKOUT_BASE}));
});
test('PROD559: recovery retains exact 040 registration and old confirmed readers',()=>{
 const f=a.productionFixture(),io=a.productionIO(f);
 const retained=['app/admin/actions/member.js','app/admin/domain/members.js','app/admin/ui/member.js'];
 assert.equal(f.recovery.paths.length,16);assert.ok(f.recovery.preconditions.some(s=>s.includes('no new unpaid-adjustment')));
 for(const p of retained)assert.equal(f.recovery.hashes[p],a.hash(io.blob(f.source,p)));
 assert.equal(f.recovery.version,'1.0.560');assert.ok(Number(a.CHECKOUT_RELEASE.version.split('.').at(-1))>560);
});
test('PROD559: both production deploy paths admit before config, DEV workflow untouched',()=>{
 for(const p of Object.values(a.PRODUCTION_WORKFLOWS).slice(1)){
  const s=read(p);assert.ok(s.indexOf('--production-source --production')>0);
  assert.ok(s.indexOf('--production-source --production')<s.indexOf(p.includes('cloudflare')?'Build isolated':'Prepare public site'));
 }
 assert.ok(read('.github/workflows/tennisnote-public-ci.yml').includes("^PROD559:"));
 assert.ok(!Object.keys(a.PRODUCTION_TOOL_PINS).includes('.github/workflows/deploy-cloudflare-pages-dev.yml'));
});
test('PROD559: runtime-delta exact36 includes isolated HTTP transport and build guards',()=>{
 const {f,io,bodies,paths}=productionFixture();
 assert.equal(a.proveProductionTree(head,io,f).paths,36);
 const helper=bodies[a.PRODUCTION_HTTP_HELPER];
 assert.equal(helper.replace(f.httpHelper.after,f.httpHelper.before),io.blob(f.base,a.PRODUCTION_HTTP_HELPER));
 assert.ok(helper.includes('"production_member_release"'));assert.ok(helper.includes('"production_admin_release"'));
 assert.ok(paths.includes('scripts/check_production_release_order.py'));
 assert.ok(paths.includes('tests/r3-production-runtime-order.test.py'));
 for(const path of Object.values(a.PRODUCTION_WORKFLOWS).slice(1)){
  const s=bodies[path],guard=s.indexOf('run: python scripts/check_production_release_order.py');
  assert.ok(guard>s.indexOf(path.includes('cloudflare')?'Build isolated':'Generate browser client configuration'));
  assert.ok(guard<s.indexOf(path.includes('cloudflare')?'Deploy member PWA':'Upload GitHub Pages artifact'));
  if(path.includes('deploy-pages'))assert.ok(s.includes('check_production_release_order.py --github-pages'));
 }
 const ci=bodies['.github/workflows/tennisnote-public-ci.yml'];
 assert.ok(ci.includes('python -B tests/r3-production-runtime-order.test.py'));
 assert.equal((ci.match(/"scripts\/check_r3_dev_deployment.py"/g)||[]).length,2);
 for(const p of ['scripts/check_production_release_order.py',a.PRODUCTION_HTTP_HELPER,'tests/r3-production-runtime-order.test.py'])
  assert.throws(()=>a.proveProductionTree(head,{...io,blob:(r,path)=>r===head&&path===p?io.blob(r,path)+' ':io.blob(r,path)},f));
});
const candidate = productionOnly?{}:Object.fromEntries(a.PATHS.map(p => [p, read(p)]));
const baseline = productionOnly?{}:Object.fromEntries([...a.METADATA, ...a.WORKFLOWS].map(p => [p, a.IO.blob(a.BASE, p)]));
function fixture() {
  const files = {...candidate}, reads = [], sourceOverrides = {}, releaseOverrides = {};
  const io = {
    tree: r => r === a.BASE ? a.BASE_TREE : r === source ? sourceTree : releaseTree,
    parents: r => r === head ? [source] : r === source ? [a.BASE] : [a.TARGET[0], head],
    changes: (from = a.BASE, to = head) => (to === source ? a.SOURCE_PATHS : from === source ? [...a.METADATA].sort() : a.PATHS).map(p => [from === a.BASE && a.NEW_PATHS.includes(p) ? "A" : "M", p]), mode: () => "100644",
    blob: (r, p) => { assert.ok(a.PATHS.includes(p)); reads.push(p); if (r === a.BASE) return baseline[p]; if (r === source) return sourceOverrides[p] ?? (a.METADATA.includes(p) ? baseline[p] : files[p]); return releaseOverrides[p] ?? files[p]; },
  };
  return {io, files, reads, sourceOverrides, releaseOverrides};
}
function event(manual = false) {
  const ref = manual ? "refs/heads/" + a.BRANCH : "refs/pull/999/merge";
  const index = manual ? 1 : 0, sha = manual ? head : merge;
  return {repo: a.REPOSITORY, attempt: "1", event: manual ? "workflow_dispatch" : "pull_request", workflow: a.WORKFLOW_NAMES[index], workflowRef: a.REPOSITORY + "/" + a.WORKFLOWS[index] + "@" + ref, workflowSha: sha, sha, ref, refType: "branch", input: head, checkout: sha, head, headRepo: a.REPOSITORY, headRef: a.BRANCH, base: a.TARGET[0], target: a.QA_BASE_BRANCH};
}
test("DEV564 exact candidate tree and private/public product binding", () => {
  const p = a.proveTree(head, fixture().io);
  assert.equal(p.version, "1.0.564"); assert.equal(p.base, a.BASE);
  assert.equal(p.privateSource.lfSha256, "da6041ac9560668b4e3de0613a79adbdbb7b47bb8cf45b514843cefdc2a80d08");
  assert.equal(p.reusedFocusedCount, 60); assert.equal(a.PATHS.length, 23);
});
test("pinned QA PR merge tree and exact manual SHA both admitted", () => {
  assert.equal(a.proveEvent(event(), fixture().io).admissionRoute, "dev564-qa-pr");
  assert.equal(a.proveEvent(event(true), fixture().io).admissionRoute, "dev564-manual");
});
for (const [name, patch] of Object.entries({fork: {headRepo: "other/repo"}, production: {target: "main"}, targetDrift: {base: "f".repeat(40)}, branch: {headRef: "codex/other"}, rerun: {attempt: "2"}, workflow: {workflow: "unknown"}, ref: {ref: "refs/heads/main"}, workflowSha: {workflowSha: head}, workflowRef: {workflowRef: "wrong"}, checkout: {checkout: head}})) {
  test("PR rejects " + name, () => assert.throws(() => a.proveEvent({...event(), ...patch}, fixture().io)));
}
for (const [name, patch] of Object.entries({push: {event: "push"}, wrongSha: {input: merge}, tag: {refType: "tag"}, origin: {repo: "other/repo"}, production: {ref: "refs/heads/main"}, rerun: {attempt: "2"}})) {
  test("manual rejects " + name, () => assert.throws(() => a.proveEvent({...event(true), ...patch}, fixture().io)));
}
test("unknown path rejected before any candidate body read", () => {
  const f = fixture(), original = f.io.changes;
  f.io.changes = () => [...original(), ["M", "outside-allowed-scope"]];
  assert.throws(() => a.proveTree(head, f.io), /EXACT_SCOPE/); assert.equal(f.reads.length, 0);
});
for (const mode of ["120000", "100755"]) test("reject mode " + mode, () => {
  const f = fixture(); f.io.mode = () => mode;
  assert.throws(() => a.proveTree(head, f.io), /FILE_KIND/); assert.equal(f.reads.length, 0);
});
test("deleted/missing path and modified-new path rejected", () => {
  for (const kind of ["D", "M"]) {
    const f = fixture(), original = f.io.changes;
    f.io.changes = (from, to) => original(from, to).map(row => row[1] === a.SELF ? [kind, row[1]] : row);
    assert.throws(() => a.proveTree(head, f.io), /FILE_KIND/);
  }
});
test("source, test, adapter and each product pin cannot be replaced", () => {
  for (const p of [a.SELF, a.TEST, a.DEV, a.DEV_TEST, ...Object.keys(a.PRODUCTS)]) {
    const f = fixture(); f.files[p] += "\n";
    assert.throws(() => a.proveTree(head, f.io));
  }
});
test("old seals/goldens/guards remain outside successor delta", () => {
  for (const p of ["scripts/check_r3_display_source_admission.mjs", "scripts/check_r3_display_dev_deployment.py", "tests/r3-display-source.test.mjs"])
    assert.equal(a.PATHS.includes(p), false);
  assert.equal(a.PATHS.some(p => /projection|manual_ledger/.test(p)), false);
});
test("permission, timeout and focused collector drift all fail closed", () => {
  const edits = [[a.WORKFLOWS[0], "contents: read", "contents: write"], [a.WORKFLOWS[0], "timeout-minutes: 10", "timeout-minutes: 60"], [a.WORKFLOWS[0], a.IDENTITY_TEST, "tests/all.test.js"], [a.WORKFLOWS[1], "environment: development", "environment: production"], [a.WORKFLOWS[1], "timeout-minutes: 10", "timeout-minutes: 60"]];
  for (const [p, before, after] of edits) {
    const f = fixture(); assert.ok(f.files[p].includes(before)); f.files[p] = f.files[p].replace(before, after);
    assert.throws(() => a.proveTree(head, f.io), /WORKFLOW_BYTES/);
  }
});
test("workflow actually collects identity/new guards and never old full verify on successor", () => {
  const ci = candidate[a.WORKFLOWS[0]], dev = candidate[a.WORKFLOWS[1]];
  assert.ok(ci.includes("node --test " + a.TEST + " " + a.IDENTITY_TEST));
  assert.ok(ci.includes("python -B " + a.DEV_TEST));
  assert.ok(ci.includes("if: steps.display.outputs.scoped != 'true'\n        run: ./scripts/verify.sh"));
  assert.ok(ci.includes("if: steps.display.outputs.display_only == 'true'"));
  assert.ok(dev.includes("run: node " + a.SELF + " --dev-source"));
  assert.ok(dev.includes("run: python -B " + a.DEV));
  assert.equal(dev.includes("--source-only"), false); assert.equal(dev.includes("--live-preflight"), false);
});
test("metadata13 is exact official bump shape and native settings unchanged", () => {
  assert.equal(a.METADATA.length, 13);
  for (const p of a.METADATA) assert.equal(candidate[p], a.expectedMetadata(p, baseline[p]));
  assert.deepEqual(JSON.parse(candidate["app/release.json"]).nativePlatforms, JSON.parse(baseline["app/release.json"]).nativePlatforms);
  const f = fixture(); f.files["app/release.json"] = f.files["app/release.json"].replace('"1.0.564"', '"1.0.565"');
  assert.throws(() => a.proveTree(head, f.io), /METADATA_BYTES/);
});
test("base tree, parent and merge payload drift reject", () => {
  for (const route of ["base", "parent", "merge"]) {
    const f = fixture(), tree = f.io.tree;
    if (route === "parent") f.io.parents = () => [a.BASE, a.BASE];
    else f.io.tree = r => r === (route === "base" ? a.BASE : merge) ? "wrong" : tree(r);
    assert.throws(() => a.proveEvent(event(), f.io));
  }
});
test("timeout propagates; no permissive retry/fallback", () => {
  const f = fixture(); let reads = 0;
  f.io.blob = () => { reads++; throw Error("ETIMEDOUT"); };
  assert.throws(() => a.proveTree(head, f.io), /ETIMEDOUT/); assert.equal(reads, 1);
});
test("hosted dirty state, on-disk mutation and parent symlink reject", () => {
  const f = fixture();
  assert.throws(() => a.verifyCheckout(event(), {status: () => " M other", io: f.io, read: () => { throw Error("unexpected read"); }}), /HOSTED_CLEAN/);
  assert.equal(f.reads.length, 0);
  assert.throws(() => a.verifyCheckout(event(), {status: () => "", io: f.io, read: p => f.files[p] + "changed"}), /WORKTREE_BYTES/);
  assert.throws(() => a.regularPath(a.SELF, () => ({isSymbolicLink: () => true, isFile: () => true})), /SYMLINK/);
  assert.throws(() => a.regularPath("outside-scope", () => { throw Error("unexpected stat"); }), /READ_OUTSIDE_SCOPE/);
});

test("DEV564 recovery: private main binding only; public remote plan remains unapproved", () => {
  assert.deepEqual(a.PRIVATE_SOURCE, {
    base: "d33a687b120e85f8dbb77d8b28fc4a040a3ea61c", tree: "00cd817ff13642092d92c5562f06b88540d57334",
    path: "90-Dashboard/tennis-note-prototype/app.js", lfSha256: "da6041ac9560668b4e3de0613a79adbdbb7b47bb8cf45b514843cefdc2a80d08",
  });
  assert.equal(a.BASE, "b18de04ee6e883ecf4f530aee678732fb5e0d783");
  assert.equal(a.BRANCH, "codex/tennisnote-r3-registration-dev564-public-20261028");
  assert.deepEqual(a.proveTree(head, fixture().io).privateSource, a.PRIVATE_SOURCE);
  // 명시 승인된 두 층 외의 부모 연결은 계속 차단한다.
  const f = fixture(); f.io.parents = () => ["3".repeat(40)];
  assert.throws(() => a.proveEvent(event(), f.io));
  assert.equal(a.PATHS.length, 23); assert.equal(a.METADATA.length, 13);
});

test("DEV564 two-layer: source10 then metadata13 and full complement", () => {
  const f = fixture(), proof = a.proveEvent(event(), f.io);
  assert.equal(a.SOURCE_PATHS.length, 10); assert.equal(a.METADATA.length, 13);
  assert.deepEqual([...a.SOURCE_PATHS, ...a.METADATA].sort(), a.PATHS);
  assert.equal(new Set([...a.SOURCE_PATHS, ...a.METADATA]).size, 23);
  assert.deepEqual(a.TARGET, [a.BASE, a.BASE_TREE]);
  assert.equal(a.QA_BASE_BRANCH, "codex/tennisnote-r3-display-dev563-20261028");
  assert.deepEqual(proof.layers, {count: 2, sourceCommit: source, metadataCommit: head, sourceTree, metadataTree: releaseTree});
  assert.equal(proof.admissionRoute, "dev564-qa-pr");
  assert.equal(a.proveEvent(event(true), fixture().io).admissionRoute, "dev564-manual");
});

test("DEV564 two-layer: combined extra intermediate multi-parent and C-only reject", () => {
  for (const kind of ["combined", "extra", "multi", "same", "C-only"]) {
    const f = fixture(), original = f.io.parents;
    f.io.parents = r => kind === "combined" && r === head ? [a.BASE]
      : kind === "extra" && r === source ? ["6".repeat(40)]
      : kind === "multi" && r === head ? [source, a.BASE]
      : kind === "same" && r === head ? [head] : original(r);
    assert.throws(() => a.proveTree(kind === "C-only" ? source : head, f.io), /TWO_LAYER_PARENTS/);
    assert.equal(f.reads.length, 0);
  }
});

test("DEV564 two-layer: unknown or misplaced path in any layer rejected before read", () => {
  for (const layer of [[a.BASE, source], [source, head], [a.BASE, head]]) {
    for (const kind of ["extra", "missing", "wrong-kind", "rename"]) {
      const f = fixture(), original = f.io.changes;
      f.io.changes = (from, to) => {
        const rows = original(from, to); if (from !== layer[0] || to !== layer[1]) return rows;
        if (kind === "extra") return [...rows, ["M", "outside-approved-layer"]];
        if (kind === "missing") return rows.slice(1);
        return rows.map((r, i) => i ? r : [kind === "rename" ? "R100" : "D", r[1]]);
      };
      assert.throws(() => a.proveTree(head, f.io), /EXACT_SCOPE|FILE_KIND/); assert.equal(f.reads.length, 0);
    }
  }
  for (const ref of [source, head]) for (const mode of ["120000", "100755"]) {
    const f = fixture(); f.io.mode = (r, p) => r === ref && p === a.PATHS[0] ? mode : "100644";
    assert.throws(() => a.proveTree(head, f.io), /FILE_KIND/); assert.equal(f.reads.length, 0);
  }
});

test("DEV564 two-layer: source and metadata drift cannot cross layers", () => {
  for (const p of a.SOURCE_PATHS) {
    const f = fixture(); f.sourceOverrides[p] = f.files[p] + "changed";
    assert.throws(() => a.proveTree(head, f.io));
    const d = fixture(); d.releaseOverrides[p] = d.files[p] + "changed";
    assert.throws(() => a.proveTree(head, d.io), /SOURCE_BYTES/);
  }
  for (const p of a.METADATA) {
    const f = fixture(); f.sourceOverrides[p] = f.files[p];
    assert.throws(() => a.proveTree(head, f.io), /EARLY_METADATA/);
    const d = fixture(); d.releaseOverrides[p] = d.files[p] + "changed";
    assert.throws(() => a.proveTree(head, d.io), /METADATA_BYTES/);
  }
});

test("DEV564 two-layer: old dev main wrong refs merge and dirty cannot enter", () => {
  for (const patch of [{target: "dev"}, {target: "main"}, {headRef: a.QA_BASE_BRANCH}, {base: "d1a22ea5faf60b9fb97d10e5029ec6027351b759"}, {attempt: "2"}, {workflowSha: head}, {headRepo: "other/repo"}])
    assert.throws(() => a.proveEvent({...event(), ...patch}, fixture().io));
  for (const kind of ["parents", "tree"]) {
    const f = fixture(), parents = f.io.parents, tree = f.io.tree;
    if (kind === "parents") f.io.parents = r => r === merge ? [a.BASE, source] : parents(r);
    else f.io.tree = r => r === merge ? "6".repeat(40) : tree(r);
    assert.throws(() => a.proveEvent(event(), f.io), /PR_MERGE_PARENTS|MERGE_PAYLOAD/);
  }
  const f = fixture();
  assert.throws(() => a.verifyCheckout(event(), {status: () => " M preserved-other", io: f.io, read: () => { throw Error("UNEXPECTED_READ"); }}), /HOSTED_CLEAN/);
  assert.equal(f.reads.length, 0);
  assert.throws(() => a.verifyCheckout(event(), {status: () => "", io: f.io, read: p => f.files[p] + "changed"}), /WORKTREE_BYTES/);
});

// 실제 CLI 본문은 유지하고 I/O만 메모리 경계로 대체한다. 이전 검사·DB·HTTP 실행 0.
function runTwoLayerCli(manual, patch = {}) {
  const f = fixture(), e = {...event(manual), ...patch}, outputs = [], printed = [], errors = [], calls = [];
  const script = resolve(a.ROOT, a.SELF), eventPath = "synthetic-event", outputPath = "synthetic-output";
  const payload = manual ? {inputs: {candidate_sha: e.input}} : {pull_request: {head: {sha: e.head, ref: e.headRef, repo: {full_name: e.headRepo}}, base: {sha: e.base, ref: e.target}}};
  const fakeProcess = {argv: ["node", script, manual ? "--dev-source" : "--ci-route"], exitCode: 0, env: {
    GITHUB_REPOSITORY: e.repo, GITHUB_RUN_ATTEMPT: e.attempt, GITHUB_EVENT_NAME: e.event,
    GITHUB_WORKFLOW: e.workflow, GITHUB_WORKFLOW_REF: e.workflowRef, GITHUB_WORKFLOW_SHA: e.workflowSha,
    GITHUB_SHA: e.sha, GITHUB_REF: e.ref, GITHUB_REF_TYPE: e.refType, GITHUB_EVENT_PATH: eventPath, GITHUB_OUTPUT: outputPath,
  }};
  const git = (bin, args) => {
    assert.equal(bin, "git"); calls.push(Array.from(args));
    if (args[0] === "rev-parse") return args[1] === "HEAD" ? e.checkout : f.io.tree(args[1].replace(/\^\{tree\}$/, ""));
    if (args[0] === "status") return "";
    if (args[0] === "diff") { assert.ok([[a.BASE, source], [source, head], [a.BASE, head]].some(pair => pair[0] === args[3] && pair[1] === args[4])); return f.io.changes(args[3], args[4]).map(r => r.join("\t")).join("\n"); }
    if (args[0] === "ls-tree") { assert.ok(a.PATHS.includes(args.at(-1))); return f.io.mode(args[2], args.at(-1)); }
    if (args[0] === "show" && args[1] === "-s") return f.io.parents(args.at(-1)).join(" ");
    if (args[0] === "show") { const [ref, p] = args[1].split(":"); return f.io.blob(ref, p); }
    throw Error("UNEXPECTED_GIT_CALL");
  };
  const body = candidate[a.SELF].replace(/^import .*;\n/gm, "").replace(/^export /gm, "").replaceAll("import.meta.url", JSON.stringify(pathToFileURL(script).href));
  runInNewContext(body, {createHash, fileURLToPath, pathToFileURL, dirname, resolve, process: fakeProcess, execFileSync: git,
    readFileSync: p => { if (p === eventPath) return JSON.stringify(payload); const key = a.PATHS.find(n => resolve(a.ROOT, n) === p); assert.ok(key); return f.files[key]; },
    appendFileSync: (p, value) => { assert.equal(p, outputPath); outputs.push(value); },
    lstatSync: () => ({isSymbolicLink: () => false, isFile: () => true}),
    console: {log: s => printed.push(JSON.parse(s)), error: s => errors.push(s)},
    fetch: () => { throw Error("NETWORK_FORBIDDEN"); },
  }, {timeout: 5000});
  return {code: fakeProcess.exitCode, outputs, printed, errors, calls};
}

test("DEV564 two-layer: actual QA CLI collects only successor and preserved identity", () => {
  const r = runTwoLayerCli(false);
  assert.equal(r.code, 0); assert.deepEqual(r.outputs, ["scoped=true\npurchase_identity_only=true\n"]);
  assert.equal(r.printed[0].layers.sourceCommit, source); assert.equal(r.printed[0].layers.metadataCommit, head);
  assert.equal(r.printed[0].admissionRoute, "dev564-qa-pr");
  const ci = candidate[a.WORKFLOWS[0]];
  assert.equal(ci, a.expectedWorkflow(a.WORKFLOWS[0], baseline[a.WORKFLOWS[0]]));
  assert.ok(ci.includes("run: node " + a.SELF + " --ci-route"));
  assert.ok(ci.includes("node --test " + a.TEST + " " + a.IDENTITY_TEST));
  assert.ok(ci.includes("python -B " + a.DEV_TEST));
  assert.ok(ci.includes("if: steps.display.outputs.scoped != 'true'\n        run: ./scripts/verify.sh"));
  assert.equal(r.calls.filter(c => c[0] === "diff").length, 3);
  for (const target of ["dev", "main"]) { const bad = runTwoLayerCli(false, {target}); assert.equal(bad.code, 2); assert.deepEqual(bad.outputs, []); assert.deepEqual(bad.errors, ["R3_PURCHASE_IDENTITY_HOLD"]); }
});

test("DEV564 two-layer: actual manual CLI admits only D on exact future ref", () => {
  const r = runTwoLayerCli(true); assert.equal(r.code, 0); assert.deepEqual(r.outputs, []);
  assert.equal(r.printed[0].admissionRoute, "dev564-manual"); assert.equal(r.printed[0].layers.metadataCommit, head);
  const dev = candidate[a.WORKFLOWS[1]]; assert.equal(dev, a.expectedWorkflow(a.WORKFLOWS[1], baseline[a.WORKFLOWS[1]]));
  assert.ok(dev.includes("run: node " + a.SELF + " --dev-source")); assert.ok(dev.includes("run: python -B " + a.DEV));
  for (const patch of [{input: source}, {event: "push"}, {ref: "refs/heads/" + a.QA_BASE_BRANCH}, {attempt: "2"}]) {
    const bad = runTwoLayerCli(true, patch); assert.equal(bad.code, 2); assert.deepEqual(bad.outputs, []); assert.deepEqual(bad.errors, ["R3_PURCHASE_IDENTITY_HOLD"]);
  }
});

// 새 delta만 실행. 실제 고정 DEV564의 원래 proof는 그대로 재사용한다.
const termFiles=productionOnly?{}:Object.fromEntries(a.TERM_SOURCE_PATHS.map(p=>[p,read(p)]));
const priorMemo=new Map();
const prior=(method,...args)=>{
  const key=JSON.stringify([method,...args]);
  if(!priorMemo.has(key))priorMemo.set(key,a.IO[method](...args));
  return priorMemo.get(key);
};
const termMetadata=productionOnly?{}:Object.fromEntries(a.METADATA.map(p=>[p,a.expectedTermMetadata(p,prior("blob",a.TERM_BASE,p))]));
function termFixture(checkout=false){
  const base=checkout?a.CHECKOUT_BASE:a.TERM_BASE,paths=checkout?a.CHECKOUT_PATHS:a.TERM_PATHS,sourcePaths=checkout?a.CHECKOUT_SOURCE_PATHS:a.TERM_SOURCE_PATHS;
  const selected=checkout?Object.fromEntries(a.CHECKOUT_PATHS.map(p=>[p,read(p)])):{...termFiles,...termMetadata};
  const f={files:{...selected},parents:[source],sourceParents:[base],mergeParents:[a.BASE,head],status:"",diskSuffix:"",sourceOverrides:{},rows:{},mergeTree:releaseTree};
  f.io={tree:r=>r===source?sourceTree:r===head?releaseTree:r===merge?f.mergeTree:prior("tree",r),
    parents:r=>r===head?f.parents:r===source?f.sourceParents:r===merge?f.mergeParents:prior("parents",r),
    changes:(from,to)=>Object.hasOwn(f.rows,from+":"+to)?f.rows[from+":"+to]:[source,head].includes(to)?(to===source?sourcePaths:from===source?[...a.METADATA].sort():paths).map(p=>["M",p]):prior("changes",from,to),
    mode:(r,p)=>[source,head,merge].includes(r)?f.badMode===p?"120000":"100644":prior("mode",r,p),
    blob:(r,p)=>r===source?f.sourceOverrides[p]??(a.METADATA.includes(p)?prior("blob",base,p):f.files[p]??prior("blob",base,p)):[head,merge].includes(r)?f.files[p]??prior("blob",base,p):prior("blob",r,p)};
  return f;
}
function runTermCli(manual=false,f=termFixture(),patch={},checkout=false){
  const e={...event(manual),...patch},outputs=[],printed=[],errors=[],calls=[],script=resolve(a.ROOT,a.SELF);
  const payload=manual?{inputs:{candidate_sha:e.input}}:{pull_request:{head:{sha:e.head,ref:e.headRef,repo:{full_name:e.headRepo}},base:{sha:e.base,ref:e.target}}};
  const fakeProcess={argv:["node",script,manual?"--dev-source":"--ci-route",checkout?"--checkout-mode":"--term-history"],exitCode:0,env:{
    GITHUB_REPOSITORY:e.repo,GITHUB_RUN_ATTEMPT:e.attempt,GITHUB_EVENT_NAME:e.event,GITHUB_WORKFLOW:e.workflow,GITHUB_WORKFLOW_REF:e.workflowRef,GITHUB_WORKFLOW_SHA:e.workflowSha,
    GITHUB_SHA:e.sha,GITHUB_REF:e.ref,GITHUB_REF_TYPE:e.refType,GITHUB_EVENT_PATH:"term-event",GITHUB_OUTPUT:"term-output"}};
  const exec=(bin,args)=>{
    assert.equal(bin,"git");calls.push(Array.from(args));
    if(args[0]==="status")return f.status;
    if(args[0]==="rev-parse")return args[1]==="HEAD"?e.checkout:f.io.tree(args[1].replace(/\^\{tree\}$/,""));
    if(args[0]==="show"&&args[1]==="-s")return f.io.parents(args.at(-1)).join(" ");
    if(args[0]==="show")return f.io.blob(...args[1].split(":"));
    if(args[0]==="diff")return f.io.changes(args[3],args[4]).map(r=>r.join("\t")).join("\n");
    if(args[0]==="ls-tree")return f.io.mode(args[2],args.at(-1));
    throw Error("UNEXPECTED_COMMAND");
  };
  const body=f.files[a.SELF].replace(/^import .*;\n/gm,"").replace(/^export /gm,"").replaceAll("import.meta.url",JSON.stringify(pathToFileURL(script).href));
  runInNewContext(body,{createHash,fileURLToPath,pathToFileURL,dirname,resolve,process:fakeProcess,execFileSync:exec,
    readFileSync:p=>{if(p==="term-event")return JSON.stringify(payload);const name=(checkout?a.CHECKOUT_READ_PATHS:a.TERM_READ_PATHS).find(n=>resolve(a.ROOT,n)===p);assert.ok(name);return f.io.blob(head,name)+f.diskSuffix;},
    appendFileSync:(p,s)=>{assert.equal(p,"term-output");outputs.push(s);},lstatSync:()=>({isSymbolicLink:()=>false,isFile:()=>true}),
    console:{log:s=>printed.push(JSON.parse(s)),error:s=>errors.push(s)},fetch:()=>{throw Error("NETWORK_FORBIDDEN");}}, {timeout:10000});
  return {exit:fakeProcess.exitCode,outputs,printed,errors,calls};
}
const termHeld=r=>{assert.equal(r.exit,2);assert.deepEqual(r.outputs,[]);assert.deepEqual(r.printed,[]);assert.deepEqual(r.errors,["R3_PURCHASE_IDENTITY_HOLD"]);};
test("DEV565 term-history: inherited actual two-layer proof and new eight plus thirteen",()=>{
  assert.equal(a.proveTree(a.TERM_BASE).tree,a.TERM_BASE_TREE);
  const p=a.proveTermTree(head,termFixture().io);
  assert.equal(p.version,"1.0.565");assert.equal(p.privateSource.lfSha256,"5766160ea0d3ac45ae5b0d09529b74924f7a3547bfb44ba4b59db073f141d508");
  assert.match(p.privateSource.commit,/^[a-f0-9]{40}$/);assert.equal(a.TERM_SOURCE_PATHS.length,8);assert.equal(a.TERM_PATHS.length,21);
  assert.equal(a.termSeal(termFiles[a.SELF]),a.TERM_SEAL);assert.equal(p.hostedDb,0);
});
test("DEV565 term-history: actual PR CLI only new collector and exact DEV dispatch",()=>{
  const pr=runTermCli();assert.equal(pr.exit,0);assert.deepEqual(pr.outputs,["scoped=true\nterm_history_only=true\n"]);assert.equal(pr.printed[0].admissionRoute,"dev565-qa-pr");
  const dev=runTermCli(true);assert.equal(dev.exit,0);assert.deepEqual(dev.outputs,[]);assert.equal(dev.printed[0].admissionRoute,"dev565-manual");
  for(const r of [pr,dev])assert.equal(r.calls.some(c=>!["status","rev-parse","show","diff","ls-tree"].includes(c[0])),false);
});
test("DEV565 term-history: each byte path mode and layer crossing rejected",()=>{
  for(const p of a.TERM_PATHS){const f=termFixture();f.files[p]+="\n";termHeld(runTermCli(false,f));}
  for(const pair of [[a.TERM_BASE,source],[source,head],[a.TERM_BASE,head]])for(const mutate of [r=>r.slice(1),r=>[...r,["M","outside"]],r=>r.map((x,i)=>i?x:["A",x[1]])]){
    const f=termFixture();f.rows[pair.join(":")]=mutate(f.io.changes(...pair));termHeld(runTermCli(false,f));
  }
  const f=termFixture();f.badMode=a.DEV;termHeld(runTermCli(false,f));
  for(const p of a.METADATA){const g=termFixture();g.sourceOverrides[p]=termMetadata[p];termHeld(runTermCli(false,g));}
});
test("DEV565 term-history: parents merge drift fork old target rerun and production denied",()=>{
  for(const parents of [[a.TERM_BASE],[source,a.TERM_BASE],[]]){const f=termFixture();f.parents=parents;termHeld(runTermCli(false,f));}
  const f=termFixture();f.sourceParents=[a.BASE];termHeld(runTermCli(false,f));
  const m=termFixture();m.mergeParents=[a.BASE,source];termHeld(runTermCli(false,m));
  for(const patch of [{attempt:"2"},{target:"main"},{base:a.TERM_BASE},{headRepo:"other/repo"},{workflowSha:head},{checkout:head}])termHeld(runTermCli(false,termFixture(),patch));
  for(const patch of [{event:"push"},{input:source},{ref:"refs/heads/main"},{refType:"tag"},{attempt:"2"}])termHeld(runTermCli(true,termFixture(),patch));
});
test("DEV565 term-history: dirty disk and failed read have no output or retry",()=>{
  const f=termFixture();f.status=" M unrelated";termHeld(runTermCli(false,f));
  const d=termFixture();d.diskSuffix="drift";termHeld(runTermCli(false,d));
  const t=termFixture();let calls=0;t.io.blob=()=>{calls++;throw Error("SYNTHETIC_PRIVATE_ERROR");};termHeld(runTermCli(false,t));assert.equal(calls,1);
});
test("DEV565 term-history: workflow permissions target and mechanical metadata parity",()=>{
  for(const p of a.WORKFLOWS)assert.equal(termFiles[p],a.expectedTermWorkflow(p,prior("blob",a.TERM_BASE,p)));
  assert.ok(termFiles[a.WORKFLOWS[0]].includes("--test-name-pattern='"+a.TERM_PATTERN+"'"));
  assert.ok(termFiles[a.WORKFLOWS[0]].includes("python -B "+a.DEV_TEST+" TermHistory"));
  assert.ok(termFiles[a.WORKFLOWS[0]].includes("if: steps.display.outputs.scoped != 'true'\n        run: ./scripts/verify.sh"));
  assert.ok(termFiles[a.WORKFLOWS[1]].includes("environment: development"));assert.ok(termFiles[a.WORKFLOWS[1]].includes("timeout-minutes: 10"));
  assert.deepEqual(JSON.parse(termMetadata["app/release.json"]).nativePlatforms,JSON.parse(prior("blob",a.TERM_BASE,"app/release.json")).nativePlatforms);
  assert.equal(a.TERM_PATHS.some(p=>Object.hasOwn(a.PRESERVED,p)),false);
});
test("DEV565 term-history: actual public matcher and save call use fresh historical and current terms",()=>{
  const domain=termFiles["app/admin/domain/coaches.js"],action=termFiles["app/admin/actions/coach.js"];
  const extract=name=>{const tail=domain.slice(domain.indexOf("function "+name+"("));assert.ok(tail.startsWith("function "+name+"("));const end=tail.slice(1).search(/\n(?:async )?function /);assert.ok(end>0);return tail.slice(0,end+1).trim();};
  const helpers=["coachStaffServerMatches","coachStaffFreshSettlementTermMatches","coachSettlementTermDraft"].map(extract).join("\n");
  const match=runInNewContext(helpers+"\ncoachStaffServerMatches",{normalizedMemberPhone:v=>String(v||"").replace(/[^0-9]/g,""),normalizeCoachWorkBlocks:v=>v.workBlocks,normalizeCoachBreakBlocks:v=>v.breakBlocks,coachBlockSignature:JSON.stringify,coachSettlementRule:v=>v.settlement,adminLocalDateKey:()=>"2026-10-28"});
  const saved={name:"synthetic",phone:"",role:"레슨",approvalStatus:"approved",employmentStatus:"active",bio:"",serverRoleId:"synthetic-A",workBlocks:[],breakBlocks:[],settlement:{method:"ratio",ratio:0,cardBase:"cash",substitute:"actualCoach",effectiveFrom:"2026-10-26",calculationMode:"session_progress"}};
  const draft={...saved,jobTitle:"레슨",coachRoleId:"synthetic-A",settlement:{method:"ratio",ratio:40,basis:"cash_ex_vat",substitute:"actualCoach",effectiveFrom:"2026-09-01",calculationMode:"session_progress"}};
  const term={coach_role_id:"synthetic-A",effective_from:"2026-09-01",effective_to:"2026-10-25",status:"ended",settlement_type:"ratio",coach_rate:0.4,settlement_basis:"cash_ex_vat",substitute_policy:"actualCoach",settlement_calculation_mode:"session_progress"};
  const current={...term,effective_from:"2026-10-26",effective_to:null,status:"active",coach_rate:0};
  const call="coachStaffServerMatches(saved, draft, adminLiveDataState.coachSettlementTerms)";
  assert.ok(action.includes(call));const actual=terms=>runInNewContext(call,{coachStaffServerMatches:match,saved,draft,adminLiveDataState:{coachSettlementTerms:terms}});
  assert.equal(actual([term,current]),true);assert.equal(actual([term]),false);assert.equal(actual([term,term,current]),false);
  saved.settlement.ratio=0.5;assert.equal(actual([term,current]),false);
});

// 실제 미커밋 원본은 hosted NO-GO. 아래 bound SHA는 메모리 합성 CLI에만 사용한다.
function boundCheckoutFixture() {
  const f=termFixture(true);
  if(a.CHECKOUT_PRIVATE_SOURCE.commit===null) {
    let s=a.once(f.files[a.SELF],'CHECKOUT_PRIVATE_SOURCE = Object.freeze({commit:null,','CHECKOUT_PRIVATE_SOURCE = Object.freeze({commit:"'+"9".repeat(40)+'",');
    s=s.replace(/export const CHECKOUT_SEAL = "[^"]+";/,'export const CHECKOUT_SEAL = "PENDING";');
    f.files[a.SELF]=s.replace('export const CHECKOUT_SEAL = "PENDING";','export const CHECKOUT_SEAL = "'+a.hash(s)+'";');
  }
  return f;
}
test("DEV566 checkout-mode: exact seven source plus thirteen official release paths",()=>{
  const f=termFixture(true),p=a.proveCheckoutTree(head,f.io,true);
  assert.equal(p.version,"1.0.566");assert.equal(p.reusedLocalChecks,101);assert.equal(p.hostedDb,0);
  assert.equal(a.CHECKOUT_SOURCE_PATHS.length,7);assert.equal(a.CHECKOUT_PATHS.length,20);
  assert.equal(a.checkoutSeal(f.files[a.SELF]),a.CHECKOUT_SEAL);
  for(const p of Object.keys(a.CHECKOUT_CONNECTION_PINS))assert.equal(a.hash(f.files[p]),a.CHECKOUT_CONNECTION_PINS[p]);
});
test("DEV566 checkout-mode: pending real private commit denies actual PR and DEV CLI",()=>{
  if(a.CHECKOUT_PRIVATE_SOURCE.commit===null) {
    for(const manual of [false,true])termHeld(runTermCli(manual,termFixture(true),{},true));
    assert.throws(()=>a.proveCheckoutTree(head,termFixture(true).io),/PRIVATE_COMMIT_PENDING/);
  } else assert.match(a.CHECKOUT_PRIVATE_SOURCE.commit,/^[a-f0-9]{40}$/);
});
test("DEV566 checkout-mode: synthetic bound actual CLI only admits PR and exact manual DEV",()=>{
  for(const manual of [false,true]) {
    const r=runTermCli(manual,boundCheckoutFixture(),{},true);
    assert.equal(r.exit,0);assert.deepEqual(r.errors,[]);
    assert.deepEqual(r.outputs,manual?[]:["scoped=true\ncheckout_mode_only=true\n"]);
    assert.equal(r.printed[0].admissionRoute,manual?"dev566-manual":"dev566-qa-pr");
    assert.equal(r.calls.some(c=>!["status","rev-parse","show","diff","ls-tree"].includes(c[0])),false);
  }
});
test("DEV566 checkout-mode: wrong bytes paths layers and source commit binding fail closed",()=>{
  for(const p of a.CHECKOUT_PATHS){const f=boundCheckoutFixture();f.files[p]+="\n";termHeld(runTermCli(false,f,{},true));}
  for(const pair of [[a.CHECKOUT_BASE,source],[source,head],[a.CHECKOUT_BASE,head]]) {
    const f=boundCheckoutFixture();f.rows[pair.join(":")]=[...f.io.changes(...pair),["M","outside"]];termHeld(runTermCli(false,f,{},true));
  }
  const mode=boundCheckoutFixture();mode.badMode=a.DEV;termHeld(runTermCli(false,mode,{},true));
  for(const p of a.METADATA){const f=boundCheckoutFixture();f.sourceOverrides[p]=f.files[p];termHeld(runTermCli(false,f,{},true));}
  for(const parents of [[a.TERM_BASE],[source,a.CHECKOUT_BASE],[]]){const f=boundCheckoutFixture();f.parents=parents;termHeld(runTermCli(false,f,{},true));}
});
test("DEV566 checkout-mode: fork production rerun dirty and merge drift blocked",()=>{
  for(const patch of [{attempt:"2"},{target:"main"},{base:a.CHECKOUT_BASE},{headRepo:"other/repo"},{workflowSha:head},{checkout:head}])termHeld(runTermCli(false,boundCheckoutFixture(),patch,true));
  for(const patch of [{event:"push"},{input:source},{ref:"refs/heads/main"},{refType:"tag"}])termHeld(runTermCli(true,boundCheckoutFixture(),patch,true));
  const f=boundCheckoutFixture();f.status=" M unrelated";termHeld(runTermCli(false,f,{},true));
  const m=boundCheckoutFixture();m.mergeTree="8".repeat(40);termHeld(runTermCli(false,m,{},true));
});
test("DEV566 checkout-mode: official generated metadata and workflow guards match",()=>{
  const f=termFixture(true);
  for(const p of a.WORKFLOWS)assert.equal(f.files[p],a.expectedCheckoutWorkflow(p,prior("blob",a.CHECKOUT_BASE,p)));
  for(const p of a.METADATA)assert.equal(read(p),a.expectedCheckoutMetadata(p,prior("blob",a.CHECKOUT_BASE,p)));
  assert.deepEqual(JSON.parse(read("app/release.json")).nativePlatforms,JSON.parse(prior("blob",a.CHECKOUT_BASE,"app/release.json")).nativePlatforms);
  assert.ok(f.files[a.WORKFLOWS[0]].includes("python -B "+a.DEV_TEST+" CheckoutMode"));
  assert.ok(f.files[a.WORKFLOWS[0]].includes("if: steps.display.outputs.scoped != 'true'\n        run: ./scripts/verify.sh"));
  assert.ok(f.files[a.WORKFLOWS[1]].includes("environment: development"));
  assert.equal(a.CHECKOUT_PATHS.some(p=>Object.hasOwn(a.PRESERVED,p)),false);
});


// 실제 private main 연결과 새 release 층만 검사합니다. 과거 업무·DB 검사는 반복하지 않습니다.
function legacyMonthlyFixture(twoLayers=false) {
  const texts=Object.fromEntries([...a.LEGACY_PATHS,...Object.keys(a.LEGACY_READONLY)].map(p=>[p,read(p)])),baseTexts={};
  const selected=a.legacyMonthlyIO();
  for(const p of [...a.METADATA,a.LEGACY_GUARD,...Object.keys(a.LEGACY_READONLY)])baseTexts[p]=selected.blob(a.LEGACY_BASE,p);
  const reads=[],h="a".repeat(40),m="b".repeat(40),s="e".repeat(40),tree="c".repeat(40);
  const sourceTexts={...texts,...Object.fromEntries(a.METADATA.map(p=>[p,baseTexts[p]]))};
  const changes=paths=>paths.map(p=>[p===a.LEGACY_META?"A":"M",p]);
  const io={
    tree:r=>r===a.LEGACY_BASE?a.LEGACY_BASE_TREE:tree,
    parents:r=>r===m?[a.LEGACY_BASE,h]:r===h&&twoLayers?[s]:[a.LEGACY_BASE],
    changes:(b,r)=>twoLayers&&r===s?changes(a.LEGACY_SOURCE_PATHS):twoLayers&&b===s?changes(a.METADATA):changes(a.LEGACY_PATHS),
    mode:(r,p)=>r===a.LEGACY_BASE&&p===a.LEGACY_META?"":a.LEGACY_MODE_MAP[p]||"100644",
    blob:(r,p)=>{assert.ok(a.LEGACY_PATHS.includes(p)||Object.hasOwn(a.LEGACY_READONLY,p));reads.push(p);return r===a.LEGACY_BASE?baseTexts[p]:r===s?sourceTexts[p]:texts[p];},
    read:p=>{assert.ok(a.LEGACY_PATHS.includes(p)||Object.hasOwn(a.LEGACY_READONLY,p));return texts[p];}
  };
  const env={GITHUB_REPOSITORY:a.REPOSITORY,GITHUB_RUN_ATTEMPT:"1",GITHUB_EVENT_NAME:"pull_request",
    GITHUB_WORKFLOW:"Tennis Note Public PWA CI",GITHUB_REF:"refs/pull/999/merge",GITHUB_REF_TYPE:"branch",
    GITHUB_SHA:m,GITHUB_WORKFLOW_SHA:m,
    GITHUB_WORKFLOW_REF:a.REPOSITORY+"/.github/workflows/tennisnote-public-ci.yml@refs/pull/999/merge"};
  const event={number:999,pull_request:{number:999,
    base:{sha:a.LEGACY_BASE,ref:"main",repo:{full_name:a.REPOSITORY}},
    head:{sha:h,ref:a.LEGACY_BRANCH,repo:{full_name:a.REPOSITORY}}}};
  return {texts,baseTexts,reads,h,m,s,io,env,event,c:a.legacyMonthlyContext(env,event,m)};
}
test("LEGACY-MONTHLY-BIND: real merged private source and LF pins admit exact public23 only",()=>{
  const f=legacyMonthlyFixture(),p=a.proveLegacyMonthlySource(f.c,f.io),meta=JSON.parse(f.texts[a.LEGACY_META]);
  assert.equal(p.files,24);assert.equal(p.status,"SOURCE_PROVEN");assert.equal(p.privateSourceBound,true);
  assert.equal(p.privateSource.commit,"4d9e9aeaab972609f7260b3d7db068ce5708d7b9");
  assert.equal(p.privateSource.tree,"0911d86a5b424c3037ec015e430ffdc04e14be95");
  assert.equal(meta.privateSource.productPins["90-Dashboard/tennis-note-coach-app/app.js"],"99f63e7d4761a6dab35a4ca29ad88d97d871a732f4db099049159d76f35e78f9");
  assert.equal(meta.candidateCommit,null);assert.equal(p.deploymentAdmitted,false);assert.equal(p.databaseActions,0);assert.equal(p.oldChecksRepeated,0);
  assert.equal(meta.baselineFlags.development,"compatibility ON; other five OFF");assert.equal(meta.baselineFlags.production,"all six OFF");
});
test("LEGACY-MONTHLY-BIND: scoped actual route emits source-only outputs and rejects dirty or pending bytes",()=>{
  const f=legacyMonthlyFixture(),outputs=[];
  assert.equal(a.runLegacyMonthlyCi(f.env,f.event,{status:()=>"",checkout:()=>f.m,io:f.io},s=>outputs.push(s)).files,24);
  assert.deepEqual(outputs,["scoped=true\nlegacy_monthly_only=true\n"]);
  const before=outputs.length;
  assert.throws(()=>a.runLegacyMonthlyCi(f.env,f.event,{status:()=>" M synthetic",checkout:()=>f.m,io:f.io},s=>outputs.push(s)),/LEGACY_DIRTY/);
  f.texts[a.LEGACY_META]=f.texts[a.LEGACY_META].replace(a.LEGACY_PRIVATE_SOURCE.commit,"0".repeat(40));
  assert.throws(()=>a.runLegacyMonthlyCi(f.env,f.event,{status:()=>"",checkout:()=>f.m,io:f.io},s=>outputs.push(s)),/LEGACY_CONTENT_PIN/);
  assert.equal(outputs.length,before);
});
test("LEGACY-MONTHLY-BIND: unknown duplicate missing release paths reject before body reads",()=>{
  const f=legacyMonthlyFixture();
  assert.equal(a.legacyMonthlyClaimed({},{}),false);
  for(const ps of [a.LEGACY_PATHS.slice(1),[...a.LEGACY_PATHS,"unexpected"],[...a.LEGACY_PATHS,a.METADATA[0]],a.LEGACY_SOURCE_PATHS]){
    f.reads.length=0;assert.throws(()=>a.proveLegacyMonthlySource(f.c,{...f.io,changes:()=>ps.map(p=>[p===a.LEGACY_META?"A":"M",p])}),/LEGACY_EXACT_PATHS/);assert.deepEqual(f.reads,[]);
  }
  const drift=structuredClone(f.event);drift.pull_request.head.ref+="-drift";
  assert.equal(a.legacyMonthlyClaimed(f.env,drift),true);
  assert.throws(()=>a.proveLegacyMonthlySource(a.legacyMonthlyContext(f.env,drift,f.m),f.io),/LEGACY_PR/);
});
test("LEGACY-MONTHLY-BIND: two ordinary commits require exact source10 then official metadata13",()=>{
  const f=legacyMonthlyFixture(true),p=a.proveLegacyMonthlySource(f.c,f.io);assert.equal(p.layers,2);assert.equal(p.sourceCommit,f.s);
  assert.throws(()=>a.proveLegacyMonthlySource(f.c,{...f.io,changes:(b,r)=>r===f.s?f.io.changes(a.LEGACY_BASE,f.h):f.io.changes(b,r)}),/LEGACY_LAYER_PATHS/);
  assert.throws(()=>a.proveLegacyMonthlySource(f.c,{...f.io,parents:r=>r===f.s?[f.h]:f.io.parents(r)}),/LEGACY_TWO_LAYERS/);
  const pth=a.METADATA[0];assert.throws(()=>a.proveLegacyMonthlySource(f.c,{...f.io,blob:(r,p)=>r===f.s&&p===pth?f.texts[p]:f.io.blob(r,p)}),/LEGACY_LAYER_BYTES/);
});
test("LEGACY-MONTHLY-BIND: official metadata preserves native content and exceeds both live cache floors",()=>{
  const f=legacyMonthlyFixture();assert.equal(Object.keys(a.LEGACY_RELEASE_PINS).length,13);
  for(const p of a.METADATA)assert.equal(f.texts[p],a.expectedMetadata(p,f.baseTexts[p],a.LEGACY_RELEASE,"1.0.559"));
  assert.deepEqual(JSON.parse(f.texts["app/release.json"]).nativePlatforms,JSON.parse(f.baseTexts["app/release.json"]).nativePlatforms);
  const meta=JSON.parse(f.texts[a.LEGACY_META]);assert.equal(meta.releaseLayer.preservedDeployedDevSource,"2c6eba698c3eaf0bced8352d0b234d463e4689e6");
  assert.equal(a.LEGACY_RELEASE.version,"1.0.567");assert.equal(a.LEGACY_RELEASE.memberCache,"tennis-note-member-pwa-v600");assert.equal(a.LEGACY_RELEASE.coachCache,"tennis-note-coach-mode-v573");
});
test("LEGACY-MONTHLY-BIND: changed bytes modes contexts and extra parent never admit",()=>{
  const f=legacyMonthlyFixture();
  for(const patch of [{attempt:"2"},{repo:"untrusted/repo"},{workflowSha:f.h},{workflowRef:"wrong"},{base:a.BASE},{headRepo:"untrusted/repo"},{baseRepo:"untrusted/repo"},{target:"dev"},{event:"workflow_dispatch"}])
    assert.throws(()=>a.proveLegacyMonthlySource({...f.c,...patch},f.io));
  assert.throws(()=>a.proveLegacyMonthlySource(f.c,{...f.io,mode:()=>"120000"}));
  assert.throws(()=>a.proveLegacyMonthlySource(f.c,{...f.io,parents:()=>[a.LEGACY_BASE,"d".repeat(40)]}));
  for(const p of a.LEGACY_PATHS){
    assert.throws(()=>a.proveLegacyMonthlySource(f.c,{...f.io,blob:(r,q)=>f.io.blob(r,q)+(r!==a.LEGACY_BASE&&q===p?"x":"")}),/LEGACY_CONTENT_PIN/);
    assert.throws(()=>a.proveLegacyMonthlySource(f.c,{...f.io,read:q=>f.texts[q]+(q===p?"x":"")}),/LEGACY_WORKTREE_BYTES/);
  }
});
test("LEGACY-MONTHLY-BIND: main proof is source-only while dispatch and dev push stay denied",()=>{
  const f=legacyMonthlyFixture(),c={...f.c,event:"push",ref:"refs/heads/main",refType:"branch",sha:f.h,head:f.h,checkout:f.h,workflowSha:f.h,workflowRef:a.REPOSITORY+"/.github/workflows/tennisnote-public-ci.yml@refs/heads/main"};
  const p=a.proveLegacyMonthlySource(c,f.io);assert.equal(p.status,"SOURCE_PROVEN");assert.equal(p.deploymentAdmitted,false);
  assert.throws(()=>a.proveLegacyMonthlySource({...c,event:"workflow_dispatch"},f.io),/LEGACY_MAIN/);
  assert.throws(()=>a.proveLegacyMonthlySource({...c,ref:"refs/heads/dev"},f.io),/LEGACY_WORKFLOW|LEGACY_MAIN/);
});
test("LEGACY-MONTHLY-BIND: source23 sparse selection and scoped verify do not invoke old suites or deploy",()=>{
  const f=legacyMonthlyFixture(),workflow=f.texts[".github/workflows/tennisnote-public-ci.yml"],verify=f.texts["scripts/verify.sh"];
  for(const p of a.LEGACY_PATHS)assert.equal(workflow.split("            /"+p+"\n").length-1,1);
  assert.ok(workflow.indexOf("sparse-checkout: |")<workflow.indexOf("--ci-route --legacy-monthly"));
  assert.ok(workflow.includes("run: ./scripts/verify.sh --r3-legacy-monthly"));
  const start=verify.indexOf('if [[ "'),end=verify.indexOf("\nfi",start),selected=verify.slice(start,end);
  assert.ok(selected.includes('R3_LEGACY_MONTHLY_SELECTED=1 node --test --test-name-pattern="'+a.LEGACY_PATTERN+'"'));
  assert.ok(!selected.includes("build_cloudflare")&&!selected.includes("python")&&!selected.includes("tests/**/*.test.js"));
  assert.ok(end<verify.indexOf('step "테스트"'));
});


function legacyDevFixture() {
  const f=legacyMonthlyFixture(true),ref="refs/heads/"+a.LEGACY_BRANCH;
  const env={...f.env,GITHUB_EVENT_NAME:"workflow_dispatch",GITHUB_WORKFLOW:"Deploy Tennis Note development sites",
    GITHUB_REF:ref,GITHUB_SHA:f.h,GITHUB_WORKFLOW_SHA:f.h,
    GITHUB_WORKFLOW_REF:a.REPOSITORY+"/.github/workflows/deploy-cloudflare-pages-dev.yml@"+ref};
  const event={inputs:{candidate_sha:f.h}};
  return {...f,env,event,c:a.legacyMonthlyContext(env,event,f.h)};
}
const LEGACY_GUARD_PY=String.raw`
import contextlib, copy, io, json, os, pathlib, runpy, subprocess, sys, types
from unittest.mock import patch
data=json.load(sys.stdin)
loaded=runpy.run_path(data["guard"], run_name="legacy_guard_test")
g=loaded["legacy_monthly_source"].__globals__
checks=0
def ok(v):
    global checks
    assert v
    checks+=1
def hold(call,code="LEGACY_MONTHLY_"):
    global checks
    try:
        call()
    except RuntimeError as exc:
        assert str(exc).startswith(code), str(exc)
        checks+=1
    else:
        raise AssertionError("expected fail-closed")
proof=data["proof"]
env={**data["env"],"TENNISNOTE_WORKFLOW_REF":data["env"]["GITHUB_WORKFLOW_REF"],
     "TENNISNOTE_CANDIDATE_SHA":proof["head"],"TENNISNOTE_ENVIRONMENT":"development",
     "TENNISNOTE_SUPABASE_URL":"https://syntheticdev.supabase.co","TENNISNOTE_SUPABASE_PUBLISHABLE_KEY":"synthetic-public",
     "TENNISNOTE_PAYMENTS_ENABLED":"false","TENNISNOTE_PAYMENT_MODE":"disabled",
     "TENNISNOTE_ALLOWED_PAYMENT_METHODS":"","TENNISNOTE_BANK_TRANSFER_ENABLED":"false"}
fp=g["EXPECTED_DEV_PROJECT_FINGERPRINT"]
g["project_fingerprint"]=lambda u: fp if u=="https://syntheticdev.supabase.co" else "mismatch"
group=data["group"]
if group=="loader-source":
    ok(g["EXPECTED_VERSION"]=="1.0.553")
    ok(g["CACHE_FLOOR_CONTRACT"]==data["readonly"])
    original=pathlib.Path.read_text
    def missing(p,*a,**k):
        if p.name=="r3-dev-cache-floors.json":
            raise FileNotFoundError("synthetic_dependency_missing")
        return original(p,*a,**k)
    with patch.object(pathlib.Path,"read_text",missing):
        try:
            runpy.run_path(data["guard"],run_name="legacy_missing_test")
        except FileNotFoundError:
            checks+=1
        else:
            raise AssertionError("dependency fallback forbidden")
    calls=[]
    def runner(argv,**kwargs):
        calls.append((argv,kwargs))
        return types.SimpleNamespace(returncode=0,stdout=json.dumps(proof))
    g["run_git"]=lambda *a: proof["head"]
    with patch.dict(os.environ,env,clear=True),patch.object(subprocess,"run",runner):
        ok(g["legacy_monthly_source"]()["tree"]==proof["tree"])
        ok(len(calls)==1 and calls[0][0]==["node","scripts/check_r3_purchase_identity_admission.mjs","--dev-source","--legacy-monthly"])
        ok(calls[0][1]["timeout"]==30 and calls[0][1]["capture_output"] is True)
        g["validate_dispatch_context"]=lambda **k: (_ for _ in ()).throw(AssertionError("old route"))
        with patch.object(sys,"argv",["guard","--source-only"]),contextlib.redirect_stdout(io.StringIO()):
            ok(g["main"]()==0)
        ok(len(calls)==2)
        for value in (types.SimpleNamespace(returncode=2,stdout=""),types.SimpleNamespace(returncode=0,stdout="invalid")):
            with patch.object(subprocess,"run",return_value=value):
                hold(g["legacy_monthly_source"])
        with patch.object(subprocess,"run",side_effect=subprocess.TimeoutExpired("synthetic",30)):
            hold(g["legacy_monthly_source"])
    for changes in ({"GITHUB_RUN_ATTEMPT":"2"},{"GITHUB_REPOSITORY":"untrusted/repo"},
                    {"GITHUB_EVENT_NAME":"push"},{"GITHUB_REF":"refs/heads/main"},{"GITHUB_REF_TYPE":"tag"},
                    {"GITHUB_WORKFLOW_SHA":"0"*40},{"TENNISNOTE_CANDIDATE_SHA":"0"*40},
                    {"TENNISNOTE_WORKFLOW_REF":"wrong"},{"TENNISNOTE_ENVIRONMENT":"production"},
                    {"TENNISNOTE_SUPABASE_URL":"http://syntheticdev.supabase.co"},
                    {"TENNISNOTE_SUPABASE_URL":"https://wrong.supabase.co"},
                    {"TENNISNOTE_SUPABASE_PUBLISHABLE_KEY":""},{"TENNISNOTE_PAYMENTS_ENABLED":"true"},
                    {"TENNISNOTE_PAYMENT_MODE":"multi"},{"TENNISNOTE_ALLOWED_PAYMENT_METHODS":"card"},
                    {"TENNISNOTE_BANK_TRANSFER_ENABLED":"true"}):
        before=len(calls)
        with patch.dict(os.environ,{**env,**changes},clear=True),patch.object(subprocess,"run",runner):
            hold(g["legacy_monthly_source"])
        ok(len(calls)==before)
    for changes in ({"layers":1},{"files":23},{"immutableDependencies":0},{"tree":"invalid"},
                    {"privateSource":{}},{"privateSource":[]},{"release":{}},{"head":"0"*40},
                    {"admissionRoute":"old566"}):
        hold(lambda c=changes:g["legacy_monthly_proof"]({**proof,**c},proof["head"]))
elif group=="runtime":
    files={}
    class MemPath:
        def __init__(self,s): self.s=s
        def __truediv__(self,k): return MemPath(self.s+"/"+k)
        def read_text(self,**k): return files[self.s]
        def read_bytes(self): return files[self.s].encode()
    g["ROOT"]=MemPath("repo")
    release={"version":"1.0.567","releaseId":"2026.10.29.01","nativePlatforms":{"synthetic":"preserved"}}
    browser={"environment":"development","supabaseUrl":"https://syntheticdev.supabase.co",
             "projectFingerprint":fp,"supabasePublishableKey":"synthetic-public"}
    payment={"enabled":False,"mode":"disabled","allowedMethods":[],"bankTransfer":{"enabled":False},"channels":{}}
    def config(b,p):
        return "window.TENNISNOTE_CONFIG = "+json.dumps(b)+";\n\nwindow.TENNIS_NOTE_PAYMENT_CONFIG = "+json.dumps(p)+";\n"
    files["repo/app/release.json"]=json.dumps(release)
    for root in ("member","admin"):
        files[root+"/release.json"]=json.dumps(release)
        files[root+"/shared/config.local.js"]=config(browser,payment)
        files[root+"/index.html"]="개발계 · 실제 결제·푸시 차단"
    for path,source,cache in (("service-worker.js","app/tennis-note-member-app/service-worker.js","tennis-note-member-pwa-v600"),
                              ("tennis-note-coach-app/service-worker.js","app/tennis-note-coach-app/service-worker.js","tennis-note-coach-mode-v573")):
        files["member/"+path]=files["repo/"+source]='const CACHE_NAME = "'+cache+'";'
    call=lambda:g["legacy_monthly_artifacts"](proof,MemPath("member"),MemPath("admin"))
    call();checks+=1
    original=copy.deepcopy(files)
    for key,value in (("environment","production"),("projectFingerprint","wrong"),("supabaseUrl","https://wrong.supabase.co"),
                      ("supabasePublishableKey",""),("pushEnabled",True)):
        files["admin/shared/config.local.js"]=config({**browser,key:value},payment);hold(call)
        files.clear();files.update(original)
    for key,value in (("enabled",True),("mode","multi"),("allowedMethods",["card"]),("bankTransfer",{"enabled":True}),
                      ("channels",{"card":"synthetic"}),("channelKey","synthetic"),("storeId","synthetic")):
        files["member/shared/config.local.js"]=config(browser,{**payment,key:value});hold(call)
        files.clear();files.update(original)
    for name in ("admin/index.html","member/release.json","member/service-worker.js"):
        files[name]="missing" if name.endswith(".html") else files[name]+"drift"
        hold(call) if not name.endswith(".json") else None
        if name.endswith(".json"):
            try: call()
            except ValueError: checks+=1
            else: raise AssertionError("release JSON drift")
        files.clear();files.update(original)
elif group=="live":
    states=[{"release":{"version":"1.0.566","releaseId":"2026.10.28.05"},"member_cache":599,"coach_cache":572} for _ in range(2)]
    production={"version":"1.0.559","releaseId":"2026.10.29.01"}
    reads=[]
    g["read_live_dev_states"]=lambda candidate:copy.deepcopy(states)
    g["_http_read"]=lambda role,candidate:reads.append((role,candidate)) or copy.deepcopy(production)
    g["legacy_monthly_live"](proof);ok(len(reads)==3)
    original=copy.deepcopy(states)
    for key,value in (("member_cache",600),("coach_cache",571),("release",{"version":"1.0.567","releaseId":"2026.10.29.01"})):
        states[0][key]=value;before=len(reads);hold(lambda:g["legacy_monthly_live"](proof));ok(len(reads)==before)
        states[:]=copy.deepcopy(original)
    for key,value in (("version","1.0.560"),("releaseId","2026.10.29.02")):
        old=production[key];production[key]=value;hold(lambda:g["legacy_monthly_live"](proof));production[key]=old
elif group in ("target","target-domain-shape"):
    account="a"*32
    target={**env,"CLOUDFLARE_ACCOUNT_ID":account,"CLOUDFLARE_API_TOKEN":"synthetic-readonly",
            "EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT":g["sha256"](account.encode())}
    calls=[];mode="valid"
    def get(a,t,path):
        calls.append(path)
        name=path.split("/")[2]
        domain=g["EXPECTED_PROJECT_DOMAINS"][name]
        if "/deployments?" not in path:
            item={"name":name,"production_branch":"dev","subdomain":domain,"domains":[domain]}
            if mode=="wrong-branch": item["production_branch"]="main"
            if mode=="prod-domain": item["domains"].append("tennisnote-app.pages.dev")
            if mode=="wrong-domain": item["subdomain"]="wrong.pages.dev"
            if mode=="domains-string": item["domains"]=domain
            if mode=="domains-dict": item["domains"]=[domain,{"synthetic":"invalid"}]
            if mode=="domains-null": item["domains"]=None
            return {"result":item}
        row={"id":"-".join(("00000000","0000","4000","8000","000000000001")),
             "environment":"production","url":"https://synthetic."+domain,"created_on":"synthetic",
             "latest_stage":{"status":"success"},"deployment_trigger":{"metadata":{"branch":"dev","commit_hash":"2c6eba698c3eaf0bced8352d0b234d463e4689e6"}}}
        if mode=="wrong-source": row["deployment_trigger"]["metadata"]["commit_hash"]="0"*40
        if mode=="failed": row["latest_stage"]["status"]="failure"
        return {"result":[row]}
    if group=="target":
        ok(len(g["legacy_monthly_target"](target,get))==64);ok(len(calls)==4)
        for patcher in ({"EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT":"0"*64},{"CLOUDFLARE_ACCOUNT_ID":"invalid"},{"CLOUDFLARE_API_TOKEN":""}):
            calls.clear();hold(lambda p=patcher:g["legacy_monthly_target"]({**target,**p},get));ok(not calls)
        for mode in ("wrong-branch","prod-domain","wrong-domain","wrong-source","failed"):
            hold(lambda:g["legacy_monthly_target"](target,get),"" if mode=="failed" else "LEGACY_MONTHLY_")
    else:
        for mode in ("domains-string","domains-dict","domains-null"):
            hold(lambda:g["legacy_monthly_target"](target,get),"LEGACY_MONTHLY_TARGET_PROJECT")
elif group=="transport":
    ok(any(isinstance(h,g["_NoRedirectHandler"]) for h in g["_LIVE_READ_OPENER"].handlers))
    ok(g["_NoRedirectHandler"]().redirect_request(None,None,302,"",{},"https://wrong.invalid") is None)
    calls=[]
    class Response:
        raw=b'{"success":true,"result":{}}'
        def __enter__(self): return self
        def __exit__(self,*a): pass
        def read(self,limit): ok(limit==2000001);return self.raw
    response=Response()
    class Opener:
        def open(self,request,timeout):
            calls.append((request,timeout));return response
    g["_LIVE_READ_OPENER"]=Opener()
    p="pages/projects/tennisnote-app-dev"
    g["legacy_monthly_cloudflare_get"]("a"*32,"synthetic",p)
    ok(len(calls)==1 and calls[0][1]==20 and calls[0][0].get_method()=="GET")
    ok(calls[0][0].full_url.startswith("https://api.cloudflare.com/client/v4/accounts/"))
    before=len(calls)
    hold(lambda:g["legacy_monthly_cloudflare_get"]("a"*32,"synthetic","pages/projects/tennisnote-app"));ok(len(calls)==before)
    response.raw=b"x"*2000001;hold(lambda:g["legacy_monthly_cloudflare_get"]("a"*32,"synthetic",p))
    response.raw=b"invalid";hold(lambda:g["legacy_monthly_cloudflare_get"]("a"*32,"synthetic",p))
elif group=="dispatch":
    order=[]
    g["legacy_monthly_source"]=lambda:order.append("source") or proof
    g["legacy_monthly_artifacts"]=lambda *a:order.append("artifact")
    g["legacy_monthly_live"]=lambda *a:order.append("live")
    g["legacy_monthly_target"]=lambda *a:order.append("target") or "0"*64
    with contextlib.redirect_stdout(io.StringIO()):
        g["legacy_monthly_dispatch"](types.SimpleNamespace(source_only=False,live_preflight=True,branch_preflight=False))
    ok(order==["source","artifact","live","target"])
    for flags in ((False,False,True),(True,True,False),(False,False,False)):
        before=len(order);hold(lambda f=flags:g["legacy_monthly_dispatch"](types.SimpleNamespace(source_only=f[0],live_preflight=f[1],branch_preflight=f[2])));ok(len(order)==before)
    def blocked(*args): order.append("artifact-hold");raise RuntimeError("LEGACY_MONTHLY_ARTIFACT_RUNTIME")
    g["legacy_monthly_artifacts"]=blocked
    before=len(order);hold(lambda:g["legacy_monthly_dispatch"](types.SimpleNamespace(source_only=False,live_preflight=True,branch_preflight=False)))
    ok(order[before:]==["source","artifact-hold"])
else:
    raise AssertionError("unknown synthetic group")
print(json.dumps({"group":group,"checks":checks,"http":0,"database":0}))
`;
function legacyGuardPython(group) {
  const f=legacyDevFixture(),proof=a.proveLegacyMonthlyDev(f.c,f.io);
  const result=spawnSync("python",["-B","-c",LEGACY_GUARD_PY],{cwd:a.ROOT,encoding:"utf8",timeout:20000,
    input:JSON.stringify({group,guard:a.LEGACY_GUARD,proof,env:f.env,readonly:JSON.parse(read(Object.keys(a.LEGACY_READONLY)[0]))})});
  assert.equal(result.status,0,result.stderr);const receipt=JSON.parse(result.stdout);
  assert.equal(receipt.group,group);assert.ok(receipt.checks>0);assert.equal(receipt.http,0);assert.equal(receipt.database,0);
}
test("LEGACY-MONTHLY-GUARD: exact source24 two actual layers and immutable dependency reach DEV consumer",()=>{
  const f=legacyDevFixture(),p=a.proveLegacyMonthlyDev(f.c,f.io);
  assert.equal(p.files,24);assert.equal(p.layers,2);assert.equal(p.immutableDependencies,1);
  assert.equal(p.admissionRoute,"legacy-monthly-dev567-manual");assert.equal(p.deploymentAdmitted,false);
  assert.equal(a.legacyMonthlyOriginalGuard(f.texts[a.LEGACY_GUARD]),f.baseTexts[a.LEGACY_GUARD]);
  const ro=Object.keys(a.LEGACY_READONLY)[0];
  assert.throws(()=>a.proveLegacyMonthlyDev(f.c,{...f.io,read:q=>f.texts[q]+(q===ro?"drift":"")}),/LEGACY_IMMUTABLE_DEPENDENCY/);
  for(const patch of [{attempt:"2"},{event:"push"},{ref:"refs/heads/main"},{input:f.s},{workflowSha:f.m},{head:f.s},{repo:"untrusted/repo"}]){
    f.reads.length=0;assert.throws(()=>a.proveLegacyMonthlyDev({...f.c,...patch},f.io),/LEGACY_DEV_CONTEXT/);assert.deepEqual(f.reads,[]);
  }
  assert.throws(()=>a.proveLegacyMonthlyDev(f.c,{...f.io,tree:()=>"0".repeat(40)}),/LEGACY_BASE/);
  assert.throws(()=>a.proveLegacyMonthlyDev(f.c,{...f.io,blob:(r,p)=>f.io.blob(r,p)+(p===a.LEGACY_GUARD&&r===f.h?"x":"")}),/LEGACY_CONTENT_PIN/);
  const single=legacyMonthlyFixture(false);
  assert.throws(()=>a.proveLegacyMonthlyDev(f.c,single.io),/LEGACY_DEV_TWO_ACTUAL_COMMITS/);
});
for(const group of ["loader-source","runtime","live","target","transport","dispatch"])
  test("LEGACY-MONTHLY-GUARD: actual Python loader and synthetic "+group,()=>legacyGuardPython(group));
test("LEGACY-MONTHLY-GUARD: added domain-shape mismatch only",()=>legacyGuardPython("target-domain-shape"));
test("LEGACY-MONTHLY-GUARD: actual Git base modes and exact source-final mode drift",()=>{
  const f=legacyDevFixture(),real=a.legacyMonthlyIO();
  for(const p of [...a.LEGACY_PATHS,...Object.keys(a.LEGACY_READONLY)]){
    const expected=p===a.LEGACY_META?"":p==="scripts/verify.sh"?"100755":"100644";
    assert.equal(real.mode(a.LEGACY_BASE,p),expected,"actual base "+p);
    assert.equal(f.io.mode(a.LEGACY_BASE,p),expected,"fixture base "+p);
  }
  assert.equal(a.LEGACY_MODE_MAP["scripts/verify.sh"],"100755");
  assert.equal(a.proveLegacyMonthlyDev(f.c,f.io).files,24);
  for(const ref of [a.LEGACY_BASE,f.s,f.h]){
    for(const [path,bad] of [["scripts/verify.sh","100644"],[a.LEGACY_GUARD,"100755"],["app/release.json","100755"]]){
      assert.throws(()=>a.proveLegacyMonthlyDev(f.c,{...f.io,mode:(r,p)=>r===ref&&p===path?bad:f.io.mode(r,p)}),
        /LEGACY_MODE|LEGACY_SOURCE_MODE/);
    }
  }
  assert.throws(()=>a.proveLegacyMonthlyDev(f.c,{...f.io,mode:(r,p)=>r===a.LEGACY_BASE&&p===a.LEGACY_META?"100644":f.io.mode(r,p)}),/LEGACY_MODE/);
  assert.throws(()=>a.proveLegacyMonthlyDev(f.c,{...f.io,mode:(r,p)=>r===f.s&&p===a.LEGACY_META?"":f.io.mode(r,p)}),/LEGACY_SOURCE_MODE/);
  assert.throws(()=>a.proveLegacyMonthlyDev(f.c,{...f.io,mode:(r,p)=>r===f.h&&p===a.LEGACY_META?"120000":f.io.mode(r,p)}),/LEGACY_MODE/);
});
test("LEGACY-MONTHLY-GUARD: sparse loader dependency and official new-only CI route preserve workflow authority",()=>{
  const f=legacyDevFixture(),w=f.texts[".github/workflows/tennisnote-public-ci.yml"],v=f.texts["scripts/verify.sh"];
  assert.equal(a.LEGACY_PATHS.length,24);assert.equal(a.LEGACY_SOURCE_PATHS.length,11);
  assert.deepEqual(Object.keys(a.LEGACY_READONLY),["tests/fixtures/r3-dev-cache-floors.json"]);
  for(const p of [...a.LEGACY_PATHS,...Object.keys(a.LEGACY_READONLY)])assert.equal(w.split("            /"+p+"\n").length-1,1);
  assert.ok(v.includes('--test-name-pattern="^LEGACY-MONTHLY-GUARD:"'));
  const pr=legacyMonthlyFixture(true),outputs=[];
  assert.equal(a.runLegacyMonthlyCi(pr.env,pr.event,{status:()=>"",checkout:()=>pr.m,io:pr.io},s=>outputs.push(s)).files,24);
  assert.deepEqual(outputs,["scoped=true\nlegacy_monthly_only=true\n"]);
});
