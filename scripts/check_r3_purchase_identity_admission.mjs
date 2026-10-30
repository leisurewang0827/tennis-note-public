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
// 기존 DEV564 두 층은 변경하지 않고 exact 후속 두 층만 별도로 검증한다.
export const TERM_BASE = "80147fb6c0ae1de7fb539587a6370fdbf7af67f5";
export const TERM_BASE_TREE = "adc8ceb8aaccca0720d74de4aa97b019f991e272";
export const TERM_PRODUCTS = Object.freeze({
  "app/admin/actions/coach.js": "48a36468df968686b913051dab2346318100571462814f40ae4d1b5fe89298bf",
  "app/admin/domain/coaches.js": "2380cd04d5c31107482d04e02647ed2901b50a197d2bf5051339d152c4cf37bc",
});
export const TERM_PRIVATE_SOURCE = Object.freeze({commit:"c0ab08ef6c654964bc0b3d151341ec16c576022f",parent:"856ae3bd5c32888716f245e17c1e6d92cc3b27ff",path:PRIVATE_SOURCE.path,lfSha256:"5766160ea0d3ac45ae5b0d09529b74924f7a3547bfb44ba4b59db073f141d508"});
export const TERM_SOURCE_PATHS = [...Object.keys(TERM_PRODUCTS),SELF,TEST,DEV,DEV_TEST,...WORKFLOWS].sort();
export const TERM_PATHS = [...TERM_SOURCE_PATHS,...METADATA].sort();
export const TERM_READ_PATHS = [...new Set([...PATHS,...TERM_PATHS])].sort();
export const TERM_PATTERN = "^DEV565 term-history:";
export const TERM_RELEASE = Object.freeze({version:"1.0.565",appSurfaceVersion:"1.0.565",releaseId:"2026.10.28.04",deployedAt:"2026-10-28T18:49:26+09:00",memberCache:"tennis-note-member-pwa-v598",coachCache:"tennis-note-coach-mode-v571"});
export const TERM_CONNECTION_PINS = {[TEST]:"819d2c7a86e094f4035a50f9b8b37f0ecbf74c5084baafbf22544914b97810f0",[DEV]:"0ec8813b7d294944a95ef59704132e5581050700687e3fbecd22ee6c40d08e03",[DEV_TEST]:"b2afcbda854f66f886620ab345bedd2a0a883bb13a04984a139f1236f885d789"};
export const TERM_SEAL = "904fd4e9e0e1c78c46c383ee03bda6969abc47e7351653988f1c713312ef2443";

// 검수된 DEV565 그래프를 보존한 코치 정책 저장 후속. 미커밋 원본은 hosted 경로 차단.
export const CHECKOUT_BASE = "95c1339d760246cd1e0e0e671c11abbd0397fec3";
export const CHECKOUT_BASE_TREE = "0af0f67a88630815fc49b7f8c8e2d722f12f82ef";
export const CHECKOUT_PRODUCTS = Object.freeze({"app/admin/actions/member.js":"a28c3c0395e548495c54c38eff39889531ab3edb745e9b860af062b3ad3d1fce"});
export const CHECKOUT_PRIVATE_SOURCE = Object.freeze({commit:"7cb17f16a48a0aba27a81bda5d938b6bd5ca5403",parent:"c0ab08ef6c654964bc0b3d151341ec16c576022f",path:PRIVATE_SOURCE.path,lfSha256:"3eb277a0583852ffa44ef7cf259dbe8bda2dceb646ad6c3602c1cc8b959d4ad0",migrationSha256:"81672833ba677091d44d9929be1b73a22ca1489926db37cdfbc3587eea32119d"});
export const CHECKOUT_SOURCE_PATHS = [...Object.keys(CHECKOUT_PRODUCTS),SELF,TEST,DEV,DEV_TEST,...WORKFLOWS].sort();
export const CHECKOUT_PATHS = [...CHECKOUT_SOURCE_PATHS,...METADATA].sort();
export const CHECKOUT_READ_PATHS = [...new Set([...TERM_READ_PATHS,...CHECKOUT_PATHS])].sort();
export const CHECKOUT_PATTERN = "^DEV566 checkout-mode:";
export const CHECKOUT_RELEASE = Object.freeze({"version":"1.0.566","appSurfaceVersion":"1.0.566","releaseId":"2026.10.28.05","deployedAt":"2026-10-28T21:36:51+09:00","memberCache":"tennis-note-member-pwa-v599","coachCache":"tennis-note-coach-mode-v572"});
export const CHECKOUT_CONNECTION_PINS = {[TEST]:"ec95b51d0662f251e4f41ff9ff21984c6df5a07486d56e15faee7a6027e4247e",[DEV]:"5ae36cfe206655cbbb470d4324516281a580a8852ee59c2a77a504add6268898",[DEV_TEST]:"9c200fae990b7e8b8ea102cb1bb04f5a8984314b4317445a6000573794a77a03"};
export const CHECKOUT_SEAL = "f61395cceea3cddfb187caf5beadca463ab60b4b9c2e2b221e6f9a10716196e5";
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
export function expectedMetadata(name, source, release = RELEASE, previous = "1.0.563") {
  let s = lf(source);
  if (name === "app/release.json" || name === "app/shared/tennisnote-release.js") {
    for (const k of ["version", "appSurfaceVersion", "releaseId", "deployedAt"]) {
      const re = name.endsWith(".json") ? new RegExp('("'+k+'":\\s*")[^"]+(")', "g") : new RegExp('^(    '+k+': ")[^"]+(")', "gm");
      need([...s.matchAll(re)].length === 1, "RELEASE_ANCHOR");
      s = s.replace(re, (_, a, b) => a + release[k] + b);
    }
  } else {
    s = s.replace(/([^"'\s()]*)\?v=(\d+\.\d+\.\d+)/g, (m, url, v) => {
      if (url.includes("://") || url.includes("/vendor/")) return m;
      need(v === previous, "STALE_QUERY"); return url + "?v=" + release.version;
    });
    if (name.endsWith(".js")) s = s.replace(new RegExp('(\\bv:\\s*"|\\|\\|\\s*")' + previous.replaceAll(".","\\.") + '(")',"g"), (_, a, b) => a + release.version + b);
    if (name.endsWith("/service-worker.js")) {
      const re = /const CACHE_NAME = "[a-z-]+-v\d+";/g;
      need([...s.matchAll(re)].length === 1, "CACHE_ANCHOR");
      s = s.replace(re, 'const CACHE_NAME = "' + release[name.includes("member-app") ? "memberCache" : "coachCache"] + '";');
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
const allowed = name => need(CHECKOUT_READ_PATHS.includes(name), "READ_OUTSIDE_SCOPE");
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
export const termSeal = s => hash(lf(s).replace(/export const TERM_SEAL = "[^"]+";/, 'export const TERM_SEAL = "PENDING";'));
export const expectedTermMetadata = (name,source) => expectedMetadata(name,source,TERM_RELEASE,RELEASE.version);
export function expectedTermWorkflow(name,source) {
  let s=lf(source);
  if(name===WORKFLOWS[0]) {
    s=once(s,"node "+SELF+" --ci-route\n","node "+SELF+" --ci-route --term-history\n");
    return once(s,"      # 고정 운영 기준 blob", "      - name: DEV565 term history public functions and admission delta only\n        if: steps.display.outputs.term_history_only == 'true'\n        run: |\n          node --test --test-name-pattern='"+TERM_PATTERN+"' "+TEST+"\n          python -B "+DEV_TEST+" TermHistory\n      # 고정 운영 기준 blob");
  }
  need(name===WORKFLOWS[1],"WORKFLOW");
  s=once(s,"node "+SELF+" --dev-source\n","node "+SELF+" --dev-source --term-history\n");
  return once(s,"python -B "+DEV+"\n","python -B "+DEV+" --term-history\n");
}
function termDelta(io,from,to,paths) {
  const rows=io.changes(from,to);
  need(same(rows.map(r=>r[1]).sort(),paths),"EXACT_SCOPE");
  for(const [kind,p] of rows)need(kind==="M"&&io.mode(to,p)==="100644","FILE_KIND");
}
export function proveTermTree(ref,io=IO) {
  need(io.tree(TERM_BASE)===TERM_BASE_TREE,"BASE_TREE");
  const parents=io.parents(ref),source=parents[0];
  need(/^[a-f0-9]{40}$/.test(ref)&&parents.length===1&&/^[a-f0-9]{40}$/.test(source||"")&&source!==ref&&source!==TERM_BASE&&same(io.parents(source),[TERM_BASE]),"TWO_LAYER_PARENTS");
  termDelta(io,TERM_BASE,source,TERM_SOURCE_PATHS);
  termDelta(io,source,ref,[...METADATA].sort());
  termDelta(io,TERM_BASE,ref,TERM_PATHS);
  const inherited=proveTree(TERM_BASE,io);
  need(inherited.tree===TERM_BASE_TREE,"BASE_TREE");
  for(const p of TERM_SOURCE_PATHS) {
    const value=io.blob(source,p);
    if(p===SELF)need(termSeal(value)===TERM_SEAL,"SOURCE_SEAL");
    else if(TERM_PRODUCTS[p]||TERM_CONNECTION_PINS[p])need(hash(value)===(TERM_PRODUCTS[p]||TERM_CONNECTION_PINS[p]),"CONTENT_PIN");
    else need(value===expectedTermWorkflow(p,io.blob(TERM_BASE,p)),"WORKFLOW_BYTES");
    need(io.blob(ref,p)===value,"SOURCE_BYTES");
  }
  for(const p of METADATA) {
    const previous=io.blob(TERM_BASE,p);
    need(io.mode(source,p)==="100644"&&io.blob(source,p)===previous,"EARLY_METADATA");
    need(io.blob(ref,p)===expectedTermMetadata(p,previous),"METADATA_BYTES");
  }
  need(/^[a-f0-9]{40}$/.test(TERM_PRIVATE_SOURCE.commit),"PRIVATE_COMMIT_PENDING");
  const sourceTree=io.tree(source),metadataTree=io.tree(ref);
  need(/^[a-f0-9]{40}$/.test(sourceTree)&&/^[a-f0-9]{40}$/.test(metadataTree)&&sourceTree!==metadataTree&&sourceTree!==TERM_BASE_TREE&&metadataTree!==TERM_BASE_TREE,"LAYER_TREES");
  return {contract:"r3-term-history-source/1",base:TERM_BASE,priorBase:BASE,tree:metadataTree,layers:{count:2,sourceCommit:source,metadataCommit:ref,sourceTree,metadataTree},release:TERM_RELEASE,version:TERM_RELEASE.version,privateSource:TERM_PRIVATE_SOURCE,productHashes:{...PRODUCTS,...TERM_PRODUCTS},environment:"development",reusedLocalChecks:59,hostedDb:0};
}
export const checkoutSeal = s => hash(lf(s).replace(/export const CHECKOUT_SEAL = "[^"]+";/, 'export const CHECKOUT_SEAL = "PENDING";'));
export const expectedCheckoutMetadata = (p,s) => expectedMetadata(p,s,CHECKOUT_RELEASE,TERM_RELEASE.version);
export function expectedCheckoutWorkflow(name,source) {
  let s=lf(source);
  if(name===WORKFLOWS[0]) {
    s=once(s,"--ci-route --term-history\n","--ci-route --checkout-mode\n");
    return once(s,"      # 고정 운영 기준 blob","      - name: DEV566 checkout policy public function and admission delta only\n        if: steps.display.outputs.checkout_mode_only == 'true'\n        run: |\n          node --test --test-name-pattern='"+CHECKOUT_PATTERN+"' "+TEST+"\n          python -B "+DEV_TEST+" CheckoutMode\n      # 고정 운영 기준 blob");
  }
  need(name===WORKFLOWS[1],"WORKFLOW");
  s=once(s,"--dev-source --term-history\n","--dev-source --checkout-mode\n");
  return once(s,"python -B "+DEV+" --term-history\n","python -B "+DEV+" --checkout-mode\n");
}
export function proveCheckoutTree(ref,io=IO,allowUnboundLocal=false) {
  need(io.tree(CHECKOUT_BASE)===CHECKOUT_BASE_TREE,"BASE_TREE");
  const parents=io.parents(ref),source=parents[0];
  need(/^[a-f0-9]{40}$/.test(ref)&&parents.length===1&&/^[a-f0-9]{40}$/.test(source||"")&&source!==ref&&source!==CHECKOUT_BASE&&same(io.parents(source),[CHECKOUT_BASE]),"TWO_LAYER_PARENTS");
  termDelta(io,CHECKOUT_BASE,source,CHECKOUT_SOURCE_PATHS);termDelta(io,source,ref,[...METADATA].sort());termDelta(io,CHECKOUT_BASE,ref,CHECKOUT_PATHS);
  need(proveTermTree(CHECKOUT_BASE,io).tree===CHECKOUT_BASE_TREE,"BASE_TREE");
  for(const p of CHECKOUT_SOURCE_PATHS) {
    const value=io.blob(source,p);
    if(p===SELF)need(checkoutSeal(value)===CHECKOUT_SEAL,"SOURCE_SEAL");
    else if(CHECKOUT_PRODUCTS[p]||CHECKOUT_CONNECTION_PINS[p])need(hash(value)===(CHECKOUT_PRODUCTS[p]||CHECKOUT_CONNECTION_PINS[p]),"CONTENT_PIN");
    else need(value===expectedCheckoutWorkflow(p,io.blob(CHECKOUT_BASE,p)),"WORKFLOW_BYTES");
    need(io.blob(ref,p)===value,"SOURCE_BYTES");
  }
  for(const p of METADATA) {
    const before=io.blob(CHECKOUT_BASE,p);
    need(io.mode(source,p)==="100644"&&io.blob(source,p)===before,"EARLY_METADATA");
    need(io.blob(ref,p)===expectedCheckoutMetadata(p,before),"METADATA_BYTES");
  }
  const bound=/^[a-f0-9]{40}$/.test(CHECKOUT_PRIVATE_SOURCE.commit||"");
  need(bound||allowUnboundLocal===true&&CHECKOUT_PRIVATE_SOURCE.commit===null,"PRIVATE_COMMIT_PENDING");
  const sourceTree=io.tree(source),metadataTree=io.tree(ref);
  need(/^[a-f0-9]{40}$/.test(sourceTree)&&/^[a-f0-9]{40}$/.test(metadataTree)&&sourceTree!==metadataTree&&sourceTree!==CHECKOUT_BASE_TREE&&metadataTree!==CHECKOUT_BASE_TREE,"LAYER_TREES");
  return {contract:"r3-checkout-mode-source/1",base:CHECKOUT_BASE,tree:metadataTree,layers:{count:2,sourceCommit:source,metadataCommit:ref,sourceTree,metadataTree},release:CHECKOUT_RELEASE,version:CHECKOUT_RELEASE.version,privateSource:CHECKOUT_PRIVATE_SOURCE,privateCommitBound:bound,productHashes:{...PRODUCTS,...TERM_PRODUCTS,...CHECKOUT_PRODUCTS},environment:"development",reusedLocalChecks:101,hostedDb:0};
}
export function proveEvent(c, io = IO, term = false, checkout = false) {
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
  const proof = checkout ? proveCheckoutTree(c.head,io) : term ? proveTermTree(c.head,io) : proveTree(c.head, io);
  need(io.tree(c.checkout) === proof.tree, "MERGE_PAYLOAD");
  return {...proof, head: c.head, checkout: c.checkout, event: c.event, ref: c.ref, admissionRoute: (checkout?"dev566-":term?"dev565-":"dev564-")+(c.event === "workflow_dispatch" ? "manual" : "qa-pr")};
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
export function verifyCheckout(c, host = {status: () => git("status", "--porcelain", "--untracked-files=all"), io: IO, read: disk}, term = false, checkout = false) {
  need(host.status() === "", "HOSTED_CLEAN");
  const proof = proveEvent(c, host.io,term,checkout);
  for (const p of checkout?CHECKOUT_READ_PATHS:term?TERM_READ_PATHS:PATHS) need(host.read(p) === host.io.blob(c.checkout, p), "WORKTREE_BYTES");
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
export function localTermOverlay() {
  need(git("rev-parse","HEAD")===TERM_BASE&&git("diff","--cached","--name-only")==="","LOCAL_BASE_INDEX");
  const dirty=[...git("diff","--name-only").split("\n"),...git("ls-files","--others","--exclude-standard").split("\n")].filter(Boolean);
  need(same(dirty.filter(p=>!Object.hasOwn(PRESERVED,p)).sort(),TERM_SOURCE_PATHS),"LOCAL_SOURCE_SCOPE");
  for(const [p,h]of Object.entries(PRESERVED))need(hash(readFileSync(resolve(ROOT,p)))===h,"PRESERVED_DIRTY");
  const source="c".repeat(40),release="d".repeat(40);
  const io={...IO,tree:r=>r===source?"e".repeat(40):r===release?"f".repeat(40):IO.tree(r),parents:r=>r===release?[source]:r===source?[TERM_BASE]:IO.parents(r),
    changes:(f,t)=>[source,release].includes(t)?(t===source?TERM_SOURCE_PATHS:f===source?[...METADATA].sort():TERM_PATHS).map(p=>["M",p]):IO.changes(f,t),
    mode:(r,p)=>[source,release].includes(r)?"100644":IO.mode(r,p),blob:(r,p)=>[source,release].includes(r)?METADATA.includes(p)?r===release?expectedTermMetadata(p,IO.blob(TERM_BASE,p)):IO.blob(TERM_BASE,p):TERM_SOURCE_PATHS.includes(p)?disk(p):IO.blob(TERM_BASE,p):IO.blob(r,p)};
  return {...proveTermTree(release,io),head:null,tree:null,layers:{count:2,sourceCommit:null,metadataCommit:null,sourceTree:null,metadataTree:null},status:"LOCAL_SOURCE_ONLY_METADATA_PLANNED_NOT_APPLIED"};
}
export function localCheckoutOverlay() {
  need(git("rev-parse","HEAD")===CHECKOUT_BASE&&git("diff","--cached","--name-only")==="","LOCAL_BASE_INDEX");
  const dirty=[...git("diff","--name-only").split("\n"),...git("ls-files","--others","--exclude-standard").split("\n")].filter(Boolean);
  need(same(dirty.filter(p=>!Object.hasOwn(PRESERVED,p)).sort(),CHECKOUT_PATHS),"LOCAL_SOURCE_SCOPE");
  for(const [p,h]of Object.entries(PRESERVED))need(hash(readFileSync(resolve(ROOT,p)))===h,"PRESERVED_DIRTY");
  const source="c".repeat(40),release="d".repeat(40);
  const io={...IO,tree:r=>r===source?"e".repeat(40):r===release?"f".repeat(40):IO.tree(r),parents:r=>r===release?[source]:r===source?[CHECKOUT_BASE]:IO.parents(r),changes:(f,t)=>[source,release].includes(t)?(t===source?CHECKOUT_SOURCE_PATHS:f===source?[...METADATA].sort():CHECKOUT_PATHS).map(p=>["M",p]):IO.changes(f,t),mode:(r,p)=>[source,release].includes(r)?"100644":IO.mode(r,p),blob:(r,p)=>[source,release].includes(r)?METADATA.includes(p)?r===release?disk(p):IO.blob(CHECKOUT_BASE,p):CHECKOUT_SOURCE_PATHS.includes(p)?disk(p):IO.blob(CHECKOUT_BASE,p):IO.blob(r,p)};
  return {...proveCheckoutTree(release,io,true),head:null,tree:null,layers:{count:2,sourceCommit:null,metadataCommit:null,sourceTree:null,metadataTree:null},status:"LOCAL_ONLY_PRIVATE_COMMIT_BINDING_REQUIRED"};
}
// 운영 선별 경로는 DEV의 역사적 봉인/부모 그래프를 변경하거나 우회하지 않는다.
export const PRODUCTION_FIXTURE='tests/fixtures/r3-production-purchase-selection.json';
export const PRODUCTION_SEAL='4901705ce3f62a9fa1e13337502e4968f05c924744f7b1980e18180c62f74f86';
export const PRODUCTION_TOOL_PINS={"tests/fixtures/r3-production-purchase-selection.json":"4c2f0448e932e70f1e4e9f03d1e427536eac2cc568cdee8bc5939223865d2940","tests/r3-purchase-identity-admission.test.mjs":"611721715cbb9dd8e9440bb81cd8b1f521d832a382c74d439364b068377c6c7b",".github/workflows/tennisnote-public-ci.yml":"87af457e53e0680f2e50fde67b6603b10fdcd9d58ca98daa9a31cf3f642e1f95",".github/workflows/deploy-cloudflare-pages.yml":"35f42f0b8caace8a3cf3c6d5b55287f8e4d355c0c1bb475dc45a45050e096b5b",".github/workflows/deploy-pages.yml":"f2ca1d13a51cc1c8fcf5fea6823e2eeb0d07739eebeee37243c13613a18b0c13","scripts/check_production_release_order.py":"533360968e8af20848c2702fdd9ad177316974682d98db8be65de0c29633db12","scripts/check_r3_dev_deployment.py":"d7ff9e22babe37669cfe25356c05b9a789e6898bf47218e5f3934303c1cd9bc7","tests/r3-production-runtime-order.test.py":"6af80368545774a9e82c684a7153aa0576b0aa7a392d91657044902612c0d3ec"}; // PRODUCTION_PINS
export const productionSeal=s=>hash(lf(s).replace(/export const PRODUCTION_SEAL='[^']+';/,"export const PRODUCTION_SEAL='PENDING';"));
export const productionFixture=()=>JSON.parse(readFileSync(resolve(ROOT,PRODUCTION_FIXTURE),'utf8'));
export const PRODUCTION_HTTP_HELPER='scripts/check_r3_dev_deployment.py';
export function productionHelperSource(io,f){
 const r=f.httpHelper,body=io.blob(f.base,PRODUCTION_HTTP_HELPER);
 need(hash(body)===r.baseLfSha256,'PRODUCTION_HELPER_PARENT');
 const selected=once(body,r.before,r.after);
 need(hash(selected)===r.selectedLfSha256,'PRODUCTION_HELPER_SELECTION');
 return selected;
}
export const PRODUCTION_WORKFLOWS={
  'Tennis Note Public PWA CI':'.github/workflows/tennisnote-public-ci.yml',
  'Deploy Tennis Note short URLs':'.github/workflows/deploy-cloudflare-pages.yml',
  'Deploy Tennis Note web beta':'.github/workflows/deploy-pages.yml',
};
export function productionIO(f=productionFixture()) {
 const paths=new Set([...f.rows.map(r=>r.path),SELF,...Object.keys(PRODUCTION_TOOL_PINS)]);
 const allowed=p=>need(paths.has(p),'PRODUCTION_READ_SCOPE');
 return {tree:r=>git('rev-parse',r+'^{tree}'),parents:r=>git('show','-s','--format=%P',r).split(' ').filter(Boolean),
  changes:(x,y)=>git('diff','--no-renames','--name-status',x,y).split('\n').filter(Boolean).map(s=>s.split('\t')),
  mode:(r,p)=>{allowed(p);return git('ls-tree','--format=%(objectmode)',r,'--',p);},
  blob:(r,p)=>{allowed(p);return lf(execFileSync('git',['show',r+':'+p],{cwd:ROOT,encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:15000,maxBuffer:2000000}));}};
}
export function proveProductionTree(ref,io=productionIO(),f=productionFixture()) {
 need(f.base==='15fe59bdd21bc75a70da810f3a63a0c80853f39f'&&f.source==='2c6eba698c3eaf0bced8352d0b234d463e4689e6','PRODUCTION_FIXED_SOURCES');
 need(io.tree(f.base)===f.baseTree&&io.tree(f.source)===f.sourceTree,'PRODUCTION_BASE_TREE');
 need(/^[a-f0-9]{40}$/.test(ref)&&ref!==f.base&&ref!==f.source,'PRODUCTION_COMMIT');
 const parents=io.parents(ref);need(parents.length===1,'PRODUCTION_PARENT');
 if(parents[0]!==f.base)need(same(io.parents(parents[0]),[f.base]),'PRODUCTION_TWO_LAYERS');
 const paths=[...f.rows.map(r=>r.path),SELF,...Object.keys(PRODUCTION_TOOL_PINS)].sort();
 need(paths.length===36&&new Set(paths).size===36,'PRODUCTION_SCOPE_PENDING');
 const delta=io.changes(f.base,ref);
 need(same(delta.map(r=>r[1]).sort(),paths),'PRODUCTION_EXACT_SCOPE');
 for(const [kind,p]of delta)need(kind===(io.mode(f.base,p)===''?'A':'M')&&io.mode(ref,p)==='100644','PRODUCTION_FILE_KIND');
 for(const r of f.rows){
  const original=io.blob(f.base,r.path),selected=io.blob(f.source,r.path);
  need(hash(original)===r.baseLfSha256&&hash(selected)===r.sourceLfSha256,'PRODUCTION_SOURCE_PIN');
  let expected=selected;
  if(f.metadataPaths.includes(r.path)){
   const semantic=r.semantic?once(original,r.semantic.before,r.semantic.after):original;
   expected=expectedMetadata(r.path,semantic,f.release,'1.0.558');
  }
  need(hash(expected)===f.appLfPins[r.path]&&io.blob(ref,r.path)===expected,'PRODUCTION_PRODUCT_BYTES');
 }
 for(const p of [SELF,...Object.keys(PRODUCTION_TOOL_PINS)]){
  const value=io.blob(ref,p);need(p===SELF?productionSeal(value)===PRODUCTION_SEAL:hash(value)===PRODUCTION_TOOL_PINS[p],'PRODUCTION_TOOL_BYTES');
 }
 need(io.blob(ref,PRODUCTION_HTTP_HELPER)===productionHelperSource(io,f),'PRODUCTION_HELPER_BYTES');
 const tree=io.tree(ref);need(/^[a-f0-9]{40}$/.test(tree)&&tree!==f.baseTree&&tree!==f.sourceTree,'PRODUCTION_TREE');
 return {contract:'r3-production-purchase-admission/1',head:ref,tree,base:f.base,source:f.source,paths:paths.length,environment:'production',version:f.release.version,dbApply:0};
}
export function proveProductionEvent(c,io=productionIO(),f=productionFixture()){
 need(c.repo===REPOSITORY&&c.attempt==='1'&&Object.hasOwn(PRODUCTION_WORKFLOWS,c.workflow),'PRODUCTION_CONTEXT');
 need(c.workflowSha===c.sha&&c.workflowRef===REPOSITORY+'/'+PRODUCTION_WORKFLOWS[c.workflow]+'@'+c.ref,'PRODUCTION_WORKFLOW');
 if(c.event==='pull_request'){
  need(c.workflow==='Tennis Note Public PWA CI'&&c.target==='main'&&c.base===f.base&&c.headRepo===REPOSITORY&&c.headRef===f.branch&&/^refs\/pull\/[1-9]\d*\/merge$/.test(c.ref),'PRODUCTION_PR');
  need(c.checkout===c.sha&&same(io.parents(c.sha),[f.base,c.head]),'PRODUCTION_MERGE');
 }else{
  need(c.event==='push'&&c.ref==='refs/heads/main'&&c.refType==='branch'&&c.sha===c.head&&c.checkout===c.head,'PRODUCTION_MAIN_PUSH_ONLY');
  need(same(io.parents(c.head),[f.base]),'PRODUCTION_SQUASH_PARENT');
 }
 const proof=proveProductionTree(c.head,io,f);need(io.tree(c.checkout)===proof.tree,'PRODUCTION_MERGE_TREE');return proof;
}
function productionMain(mode){
 need(['--ci-route','--production-source'].includes(mode)&&process.argv.length===4,'PRODUCTION_MODE');
 need(git('status','--porcelain','--untracked-files=all')==='','PRODUCTION_DIRTY');
 const f=productionFixture(),io=productionIO(f),c=context(process.env,JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8')),git('rev-parse','HEAD'));
 const proof=proveProductionEvent(c,io,f);
 for(const p of [...f.rows.map(r=>r.path),SELF,...Object.keys(PRODUCTION_TOOL_PINS)])need(lf(readFileSync(resolve(ROOT,p),'utf8'))===io.blob(c.checkout,p),'PRODUCTION_WORKTREE_BYTES');
 if(mode==='--ci-route'){need(c.workflow==='Tennis Note Public PWA CI','PRODUCTION_CI_WORKFLOW');appendFileSync(process.env.GITHUB_OUTPUT,'scoped=true\nproduction_only=true\n');}
 else need(c.workflow!=='Tennis Note Public PWA CI','PRODUCTION_DEPLOY_WORKFLOW');
 console.log(JSON.stringify(proof));
}
// PROD_LEGACY_SUCCESSOR_BEGIN
// 승인된 제품 다섯 개와 운영 메타데이터만 판정하며 과거 권위는 그대로 둡니다.
export const PL_BASE = "8cef5b40228c929693c31aaa8af2a089cb0262f4";
export const PL_BASE_TREE = "d912835abe666f1ce6d83f88c5cd74e52f1bb767";
export const PL_DEV = "a5503e5855d0b30e34e4992976e6303342c40f9b";
export const PL_DEV_TREE = "39b6b126b7095ca4fde7c7d20851396d3a6832df";
export const PL_DEV_PARENT = "a0ccbccdc70efa03781cc1895bcccb26742dbd09";
export const PL_DEV_PARENT_TREE = "32f73931c2f23afbd2d7e756fe8d565e9785ceb4";
export const PL_PRIVATE = Object.freeze({commit:"4d9e9aeaab972609f7260b3d7db068ce5708d7b9",tree:"0911d86a5b424c3037ec015e430ffdc04e14be95",migrationSha256:"dcf5e719a2b9726686ebf95f63df32e513c2f36d437f0cb60d1298ac854e4e57"});
export const PL_BRANCH = "codex/tennisnote-r3-production-legacy-monthly-20261029";
export const PL_PREFIX = "codex/tennisnote-r3-production-legacy-monthly-";
export const PL_PATTERN = "^PROD-LEGACY560:";
export const PL_PRODUCT_PINS = Object.freeze({"app/admin/actions/billing.js":"48c6cd5b96e8a61300ca9adfaecb9258d6d31d88018008db7819399cbd88a185","app/admin/views/billing.js":"cc7df735c1ab10cb6dfa5c19ec2383622a33d693b9b090b2c91192c4cb9a9b52","app/shared/tennisnote-settlement-adjustment.js":"d55ca914171ce380eed3e3b35d7d363428170530518e2824175cce2d3e33deb2","app/tennis-note-coach-app/domain/settlement.js":"5c50ba3a7375fe083fbcbdf0c987a0efc1d9644c4f5853a8d2762f9fa9604adb","app/tennis-note-coach-app/views/settlement.js":"2f225c94f707d0779d1de3fa4496b1e120f7bd46d3cbfdbf9383d922b97a9b86"});
export const PL_METADATA_PINS = Object.freeze({"app/admin/index.html":"7f6addc315dc1f1d779bc8c7a003b9653287d7c46fce5216f81a6b09ea9e05b1","app/release.json":"23e7deac0a12ac02319ac4c085ccdb261a68b8fdd7a65716bf4e7ccfac6e27a2","app/shared/tennisnote-release.js":"c72b0a03069dc86235d5c08dab9b1c37aae05b7e6a3b978f6212db3e5ee77776","app/tennis-note-coach-app/app.js":"4419918f727285bb35d07c71a7715db561ffa9fb7297619e10137def6e0ba80e","app/tennis-note-coach-app/domain/coaches.js":"087312fb320c3d3d522f81cf93a4f5c05d8d0dcec0818be373d306c461a869dc","app/tennis-note-coach-app/forms/common.js":"ab9eb3b747e287509d0d9b3dd86c1f0fdcb3dcbe2914721a8df41d418384cf5b","app/tennis-note-coach-app/index.html":"c9ab1d379aa206abc37f317a04ddad91bfa4dadb12e600857b7a78fdfb4ce448","app/tennis-note-coach-app/service-worker.js":"80320bb0d41f65fbbd1ebb438e58496ea45893a9691f35b631e2502c2bf834a9","app/tennis-note-member-app/app.js":"87b6e653c466b5b9a6621d23f03782d8ef07deede2acca2c7f64c694c81b7d0f","app/tennis-note-member-app/forms/common.js":"d0e556ac9a2548e7fedb775005594b5ec297fbcd7351aeb70315f64c8d790373","app/tennis-note-member-app/index.html":"b0044ff0ebdaed5cd044c2a726ecccd997b707524ac3bdef92192ecde792b869","app/tennis-note-member-app/service-worker.js":"1adcf99a47ee759e906a9645d52d39d2b2fa2ad2a3e19c1a7f7c706c284d0c9e","app/tennis-note-member-app/ui/screens.js":"9209bea288b8d5ef9980843b0e1738cc618956a2620dc7db75e9dd12428b2043"});
export const PL_RELEASE = Object.freeze({"version":"1.0.560","appSurfaceVersion":"1.0.560","releaseId":"2026.10.29.02","deployedAt":"2026-10-29T23:13:29+09:00","memberCache":"tennis-note-member-pwa-v593","coachCache":"tennis-note-coach-mode-v566"});
export const PL_TOOL_PINS = Object.freeze({"tests/r3-purchase-identity-admission.test.mjs":"b7a5dfedc03925e7b89469a9cba1212d61ab2545e9e6f43a4fd72ca8d6782ed8","scripts/verify.sh":"e0534b38b522b2f1a5de26b5c3e2c6d423788c07d5d509e8f02f0388cac1167d",".github/workflows/tennisnote-public-ci.yml":"e45c19007f3c8b66622e4328337613cae1dfe884680d944d2c786a37b7709332"});
export const PL_CONTROL_PINS = Object.freeze({"scripts/check_r3_dev_deployment.py":"d7ff9e22babe37669cfe25356c05b9a789e6898bf47218e5f3934303c1cd9bc7","scripts/check_production_release_order.py":"533360968e8af20848c2702fdd9ad177316974682d98db8be65de0c29633db12",".github/workflows/deploy-cloudflare-pages.yml":"35f42f0b8caace8a3cf3c6d5b55287f8e4d355c0c1bb475dc45a45050e096b5b",".github/workflows/deploy-pages.yml":"f2ca1d13a51cc1c8fcf5fea6823e2eeb0d07739eebeee37243c13613a18b0c13",".github/workflows/deploy-cloudflare-pages-dev.yml":"2118c7c378086e74262b48b0a0495e42abe35f9e34f2e7d3f4f50f6762b3bdd9","tests/fixtures/r3-production-purchase-selection.json":"4c2f0448e932e70f1e4e9f03d1e427536eac2cc568cdee8bc5939223865d2940"});
export const PL_OLD_SOURCE_SHA = "e82c4df3493bd7acc01bdd5cb178856fdd54da0952597fd35325f63297729a78";
export const PL_SELF_SEAL = "a9701a7370a6b1ed1859b28354591f284a798dfec890223536ce01677b5df3da";
export const PL_SOURCE_PATHS = Object.freeze([...Object.keys(PL_PRODUCT_PINS), ...Object.keys(PL_TOOL_PINS), SELF].sort());
export const PL_PATHS = Object.freeze([...PL_SOURCE_PATHS, ...Object.keys(PL_METADATA_PINS)].sort());
export const PL_MODES = Object.freeze(Object.fromEntries(PL_PATHS.map(p=>[p,p==="scripts/verify.sh"?"100755":"100644"])));
export const PL_OLD_ENTRY = "    if(process.argv[3]==='--production'){productionMain(process.argv[2]);}\n";
export const PL_NEW_ENTRY = "    if (prodLegacyRequested(process.argv, process.env)) { prodLegacyMain(process.argv[2]); }\n    else if(process.argv[3]==='--production'){productionMain(process.argv[2]);}\n";
const plNeed = (ok, code) => need(ok, "PROD_LEGACY_" + code);
const plSha = s => /^[0-9a-f]{40}$/.test(s || "") && !/^0+$/.test(s);
export function prodLegacyOriginal(s) {
  s=lf(s);
  const begin="// PROD_LEGACY_SUCCESSOR_BEGIN\n",end="// PROD_LEGACY_SUCCESSOR_END\n\n";
  plNeed(s.split(begin).length===2 && s.split(end).length===2, "ORIGINAL_MARKERS");
  const start=s.indexOf(begin),stop=s.indexOf(end);
  plNeed(start<stop, "ORIGINAL_MARKERS");
  return once(once(s,s.slice(start,stop+end.length),""),PL_NEW_ENTRY,PL_OLD_ENTRY);
}
export function prodLegacySeal(s) {
  s=lf(s);
  const re=/^export const PL_SELF_SEAL = "(?:[a-f0-9]{64}|PENDING)";$/gm;
  plNeed([...s.matchAll(re)].length===1,"SEAL_LITERAL");
  return hash(s.replace(re,'export const PL_SELF_SEAL = "PENDING";'));
}
export function prodLegacyClaimed(env,event) {
  return String(event.pull_request?.head?.ref || "").startsWith(PL_PREFIX)
    || String(env.GITHUB_REF || "").startsWith("refs/heads/"+PL_PREFIX)
    || (env.GITHUB_EVENT_NAME==="push" && event.before===PL_BASE);
}
export function prodLegacyRequested(argv,env) {
  if(argv[3]==="--production-legacy") return true;
  return Boolean(env.GITHUB_EVENT_PATH) && prodLegacyClaimed(env,JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,"utf8")));
}
export function prodLegacyIO() {
  const paths=new Set([...PL_PATHS,...Object.keys(PL_CONTROL_PINS)]);
  const allow=p=>plNeed(paths.has(p),"READ_SCOPE");
  const ref=r=>plNeed(plSha(r),"IO_REF");
  return {
    tree:r=>{ref(r);return git("rev-parse",r+"^{tree}");},
    parents:r=>{ref(r);return git("show","-s","--format=%P",r).split(" ").filter(Boolean);},
    changes:(b,h)=>{ref(b);ref(h);return git("diff","--no-renames","--name-status",b,h).split("\n").filter(Boolean).map(s=>s.split("\t"));},
    mode:(r,p)=>{ref(r);allow(p);return git("ls-tree","--format=%(objectmode)",r,"--",p);},
    blob:(r,p)=>{ref(r);allow(p);return lf(execFileSync("git",["show",r+":"+p],{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:15000,maxBuffer:2000000}));},
    read:p=>{
      allow(p);plNeed(lstatSync(ROOT).isDirectory()&&!lstatSync(ROOT).isSymbolicLink(),"ROOT_KIND");
      let path=ROOT;for(const part of p.split("/")){path=resolve(path,part);plNeed(!lstatSync(path).isSymbolicLink(),"SYMLINK");}
      plNeed(lstatSync(path).isFile(),"REGULAR_FILE");return lf(readFileSync(path,"utf8"));
    }
  };
}
function prodLegacyAnchors(io) {
  plNeed(PL_SOURCE_PATHS.length===9 && PL_PATHS.length===22 && new Set(PL_PATHS).size===22,"STATIC_SCOPE");
  plNeed(io.tree(PL_BASE)===PL_BASE_TREE && io.tree(PL_DEV)===PL_DEV_TREE
    && io.tree(PL_DEV_PARENT)===PL_DEV_PARENT_TREE
    && same(io.parents(PL_DEV),[PL_DEV_PARENT]) && same(io.parents(PL_DEV_PARENT),[PL_BASE]),"ANCHOR_GRAPH");
  plNeed(hash(io.blob(PL_BASE,SELF))===PL_OLD_SOURCE_SHA,"ORIGINAL_BASE");
  for(const [p,pin]of Object.entries(PL_PRODUCT_PINS)) {
    plNeed(io.mode(PL_DEV,p)==="100644" && io.mode(PL_DEV_PARENT,p)==="100644"
      && hash(io.blob(PL_DEV,p))===pin && io.blob(PL_DEV_PARENT,p)===io.blob(PL_DEV,p),"DEV_PRODUCT");
  }
  for(const [p,pin]of Object.entries(PL_CONTROL_PINS))
    plNeed(io.mode(PL_BASE,p)==="100644" && hash(io.blob(PL_BASE,p))===pin,"CONTROL_BASE");
}
function prodLegacyDelta(io,b,h,paths) {
  const rows=io.changes(b,h);
  plNeed(same(rows.map(r=>r[1]).sort(),paths) && rows.length===paths.length,"EXACT_SCOPE");
  for(const r of rows)plNeed(r.length===2 && r[0]==="M"
    && io.mode(b,r[1])===PL_MODES[r[1]] && io.mode(h,r[1])===PL_MODES[r[1]],"FILE_KIND_MODE");
}
export function prodLegacyBodies(read,io) {
  const body=read(SELF);
  plNeed(prodLegacyOriginal(body)===io.blob(PL_BASE,SELF)
    && hash(prodLegacyOriginal(body))===PL_OLD_SOURCE_SHA,"ORIGINAL_BYTES");
  plNeed(/^[0-9a-f]{64}$/.test(PL_SELF_SEAL)
    && body.match(/^export const PL_SELF_SEAL = "([0-9a-f]{64})";$/m)?.[1]===PL_SELF_SEAL
    && prodLegacySeal(body)===PL_SELF_SEAL,"SELF_SEAL");
  for(const [p,pin]of Object.entries(PL_PRODUCT_PINS))
    plNeed(hash(read(p))===pin && read(p)===io.blob(PL_DEV,p),"PRODUCT_BYTES");
  for(const [p,pin]of Object.entries(PL_TOOL_PINS))
    plNeed(/^[0-9a-f]{64}$/.test(pin) && hash(read(p))===pin,"TOOL_BYTES");
  for(const [p,pin]of Object.entries(PL_METADATA_PINS)) {
    const actual=read(p),baseline=io.blob(PL_BASE,p);
    plNeed(hash(actual)===pin && actual===expectedMetadata(p,baseline,PL_RELEASE,"1.0.559"),"METADATA_BYTES");
    if(p==="app/release.json")plNeed(same(JSON.parse(actual).nativePlatforms,JSON.parse(baseline).nativePlatforms),"NATIVE_METADATA");
  }
  for(const [p,pin]of Object.entries(PL_CONTROL_PINS))
    plNeed(read(p)===io.blob(PL_BASE,p) && hash(read(p))===pin,"CONTROL_BYTES");
}
export function proveProdLegacyTree(ref,io=prodLegacyIO(),squash=false) {
  plNeed(plSha(ref) && ref!==PL_BASE && ref!==PL_DEV,"REF");
  // 경로와 mode를 먼저 잠가 승인되지 않은 candidate body는 읽지 않습니다.
  const parents=io.parents(ref);plNeed(parents.length===1,"PARENT");
  prodLegacyDelta(io,PL_BASE,ref,PL_PATHS);
  let source=null;
  if(squash)plNeed(same(parents,[PL_BASE]),"SQUASH_PARENT");
  else {
    source=parents[0];
    plNeed(plSha(source) && source!==PL_BASE && source!==ref && same(io.parents(source),[PL_BASE]),"TWO_LAYERS");
    prodLegacyDelta(io,PL_BASE,source,PL_SOURCE_PATHS);
    prodLegacyDelta(io,source,ref,Object.keys(PL_METADATA_PINS).sort());
    for(const p of PL_SOURCE_PATHS)plNeed(io.blob(source,p)===io.blob(ref,p),"SOURCE_LAYER");
    for(const p of Object.keys(PL_METADATA_PINS))plNeed(io.blob(source,p)===io.blob(PL_BASE,p),"EARLY_METADATA");
  }
  prodLegacyAnchors(io);
  prodLegacyBodies(p=>io.blob(ref,p),io);
  const tree=io.tree(ref);
  plNeed(plSha(tree) && ![PL_BASE_TREE,PL_DEV_TREE].includes(tree),"TREE");
  return {contract:"r3-production-legacy-monthly-source/1",status:"SOURCE_PROVEN",head:ref,tree,base:PL_BASE,
    source:PL_DEV,sourceTree:PL_DEV_TREE,privateSource:PL_PRIVATE,files:22,layers:squash?1:2,
    graph:squash?"main-single-squash":"feature-two-ordinary",sourceCommit:source,
    release:PL_RELEASE,databaseActions:0,networkActions:0,deploymentAdmitted:false};
}
export function prodLegacyContext(env,event,checkout) {
  return {...context(env,event,checkout),before:event.before,number:event.number,
    prNumber:event.pull_request?.number,baseRepo:event.pull_request?.base?.repo?.full_name};
}
export function proveProdLegacyEvent(c,io=prodLegacyIO()) {
  plNeed(c.repo===REPOSITORY && c.attempt==="1" && Object.hasOwn(PRODUCTION_WORKFLOWS,c.workflow),"CONTEXT");
  plNeed(plSha(c.head)&&plSha(c.sha)&&c.checkout===c.sha && c.workflowSha===c.sha
    && c.workflowRef===REPOSITORY+"/"+PRODUCTION_WORKFLOWS[c.workflow]+"@"+c.ref
    && c.refType==="branch" && c.input===undefined,"WORKFLOW");
  const pr=c.event==="pull_request";
  if(pr) {
    plNeed(c.workflow==="Tennis Note Public PWA CI" && c.target==="main" && c.base===PL_BASE
      && c.headRef===PL_BRANCH && c.headRepo===REPOSITORY && c.baseRepo===REPOSITORY
      && Number.isSafeInteger(c.number)&&c.number>0 && c.number===c.prNumber
      && c.ref==="refs/pull/"+c.number+"/merge" && same(io.parents(c.sha),[PL_BASE,c.head]),"PR");
  }else plNeed(c.event==="push" && c.ref==="refs/heads/main" && c.before===PL_BASE
    && c.sha===c.head,"MAIN_PUSH");
  const proof=proveProdLegacyTree(c.head,io,!pr);
  plNeed(io.tree(c.checkout)===proof.tree,"CHECKOUT_TREE");
  return {...proof,checkout:c.checkout,event:c.event,workflow:c.workflow};
}
export function runProdLegacy(mode,c,host,emit=()=>{}) {
  plNeed(["--ci-route","--production-source"].includes(mode),"MODE");
  plNeed(host.status()==="","DIRTY");
  const proof=proveProdLegacyEvent(c,host.io);
  for(const p of [...PL_PATHS,...Object.keys(PL_CONTROL_PINS)])
    plNeed(host.read(p)===host.io.blob(c.checkout,p),"WORKTREE_BYTES");
  if(mode==="--ci-route") {
    plNeed(c.workflow==="Tennis Note Public PWA CI","CI_WORKFLOW");
    emit("scoped=true\nproduction_legacy_only=true\n");
  }else plNeed(c.workflow!=="Tennis Note Public PWA CI" && c.event==="push","DEPLOY_WORKFLOW");
  return proof;
}
export function proveProdLegacyLocal() {
  plNeed(git("rev-parse","HEAD")===PL_BASE && git("branch","--show-current")===PL_BRANCH
    && git("diff","--cached","--name-only")==="" && git("ls-files","--others","--exclude-standard")==="","LOCAL_STATE");
  const rows=git("diff","--no-renames","--name-status").split("\n").filter(Boolean).map(s=>s.split("\t"));
  plNeed(same(rows.map(r=>r[1]).sort(),PL_PATHS) && rows.every(r=>r.length===2&&r[0]==="M"),"LOCAL_SCOPE");
  const io=prodLegacyIO();prodLegacyAnchors(io);
  for(const p of PL_PATHS)plNeed(io.mode(PL_BASE,p)===PL_MODES[p],"LOCAL_MODE");
  prodLegacyBodies(io.read,io);
  return {contract:"r3-production-legacy-monthly-local/1",status:"LOCAL_SOURCE_PREPARED",base:PL_BASE,
    candidateCommit:null,tree:null,files:22,sourcePaths:9,metadataPaths:13,source:PL_DEV,
    privateSource:PL_PRIVATE,release:PL_RELEASE,realCandidateGraphProven:false,databaseActions:0,
    networkActions:0,deploymentAdmitted:false};
}
function prodLegacyMain(mode) {
  plNeed(process.argv.length===4,"ARGUMENTS");
  if(mode==="--local") {
    plNeed(process.argv[3]==="--production-legacy","LOCAL_ENTRY");
    console.log(JSON.stringify(proveProdLegacyLocal()));return;
  }
  plNeed(process.argv[3]==="--production","ENTRY");
  const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
  const io=prodLegacyIO(),c=prodLegacyContext(process.env,event,git("rev-parse","HEAD"));
  const proof=runProdLegacy(mode,c,{status:()=>git("status","--porcelain","--untracked-files=all"),io,read:io.read},
    s=>appendFileSync(process.env.GITHUB_OUTPUT,s));
  console.log(JSON.stringify(proof));
}
// PROD_LEGACY_SUCCESSOR_END

// SUMMARY_LAYOUT_SUCCESSOR_BEGIN
// 승인된 표시 hunk와 공식 버전층만 받습니다. 과거 source/검사 봉인은 그대로 보존합니다.
export const SUMMARY_PROFILES = {
  production: { base: "345d42765c6e786446e6cbb7eb1a03568665b15f", tree: "e4946727ac0ab3dc02524894914781416db260e7", branch: "codex/tennisnote-coach-settlement-summary-prod561-20261030", target: "main", previous: "1.0.560", version: "1.0.561", member: 594, coach: 567 },
  development: { base: "a5503e5855d0b30e34e4992976e6303342c40f9b", tree: "39b6b126b7095ca4fde7c7d20851396d3a6832df", branch: "codex/tennisnote-coach-settlement-summary-dev568-20261030", target: "codex/tennisnote-r3-legacy-monthly-public-20261029", previous: "1.0.567", version: "1.0.568", member: 601, coach: 574 },
};
export const SUMMARY_UI = ["app/tennis-note-coach-app/views/settlement.js", "app/tennis-note-coach-app/styles.css"];
export const SUMMARY_SEAL = "b1b9857559d64405fb811bb5e36b2191dff994ab38b01a2c775f09ce432a7175";
export const SUMMARY_TEST_SUFFIX_HASH = "a075709641810478988b8c22b883a250784bfa57aa7ac6d5225cb331bf07d649";
const summaryNeed = (ok, code) => { if (!ok) throw Error("SUMMARY_" + code); };
const summarySha = s => /^[a-f0-9]{40}$/.test(s || "") && !/^0+$/.test(s);
const SUMMARY_ENTRY = '    if (summaryRequested(process.argv.slice(2), process.env)) { summaryMain(process.argv.slice(2)); } else {\n';
export const summaryPaths = profile => [...SUMMARY_UI, SELF, TEST, ...(profile === "development" ? ["scripts/check_r3_dev_deployment.py"] : [])];
export function summaryOriginal(source) {
  source = lf(source);
  const begin = "// SUMMARY_LAYOUT_SUCCESSOR_BEGIN\n", end = "// SUMMARY_LAYOUT_SUCCESSOR_END\n\n";
  const a = source.indexOf(begin), b = source.indexOf(end);
  summaryNeed(a >= 0 && b > a && source.split(begin).length === 2 && source.split(end).length === 2, "MARKERS");
  source = source.slice(0, a) + source.slice(b + end.length);
  return once(once(source, SUMMARY_ENTRY, ""), '    } // SUMMARY_ENTRY_END\n', "");
}
export function summarySeal(source) {
  source = lf(source);
  const begin = source.indexOf("// SUMMARY_LAYOUT_SUCCESSOR_BEGIN\n"), end = source.indexOf("// SUMMARY_LAYOUT_SUCCESSOR_END\n\n");
  summaryNeed(begin >= 0 && end > begin, "SEAL_MARKERS");
  return hash(lf(source.slice(begin, end)).replace(/^export const SUMMARY_SEAL = "(?:PENDING|[a-f0-9]{64})";$/m, 'export const SUMMARY_SEAL = "PENDING";'));
}
export function summaryExpectedUi(p, source) {
  if (p === SUMMARY_UI[0]) {
    source = once(source, '  const status = $("#coachSettlementStatus");',
      '  const countValue = monthlyOnly ? "횟수 미사용" : `${Number(settlement.settledSessions) || 0}회`;\n'
      + '  const countDetail = monthlyOnly ? "월 결제 기준"\n'
      + '    : settlement.sourceEvidenceLabel ? "정산 반영 · 과거 기록은 월 결제 기준"\n'
      + '      : rows.some(monthlyRow) ? "정산 반영 · 완료·이관 수업 기준" : "완료·이관 수업 기준";\n'
      + '  const status = $("#coachSettlementStatus");');
    return once(source, '  if ($("#coachSettledSessions")) $("#coachSettledSessions").textContent = unavailable ? "확인 필요" : countLabel;',
      '  const settledCount = $("#coachSettledSessions");\n'
      + '  if (settledCount) {\n'
      + '    settledCount.textContent = unavailable ? "확인 필요" : countValue;\n'
      + '    const countDescription = settledCount.parentElement?.querySelector("small");\n'
      + '    if (countDescription) countDescription.textContent = unavailable ? "완료·이관 수업 기준" : countDetail;\n'
      + '  }');
  }
  summaryNeed(p === SUMMARY_UI[1], "UI_PATH");
  return once(source, '  .coach-settlement-summary article {\n    grid-template-columns: minmax(0, 1fr) auto;\n    align-items: center;\n  }\n',
    '  .coach-settlement-summary article {\n    grid-template-columns: minmax(7em, 1fr) minmax(0, auto);\n    align-items: center;\n  }\n\n  .coach-settlement-summary article > span {\n    word-break: keep-all;\n  }\n');
}
export function summaryBoundary(s) {
  const p = SUMMARY_PROFILES[s.profile]; summaryNeed(Boolean(p), "PROFILE");
  const sourcePaths = summaryPaths(s.profile), local = s.event === "local";
  summaryNeed(s.base === p.base && s.baseTree === p.tree && s.branch === p.branch, "BASE_BRANCH");
  summaryNeed(s.repo === REPOSITORY && s.attempt === "1", "IDENTITY");
  const paths = [...sourcePaths, ...(local ? [] : METADATA)].sort();
  summaryNeed(same(s.rows.map(r => r[1]).sort(), paths) && s.rows.length === paths.length, "PATHS");
  for (const r of s.rows) summaryNeed(r.length === 2 && r[0] === "M" && s.modes[r[1]] === "100644", "MODE");
  if (local) {
    summaryNeed(same(s.args, ["--local", "--summary-layout"]) && s.checkout === p.base && s.indexEmpty && !s.clean, "LOCAL");
    return;
  }
  summaryNeed(s.clean && summarySha(s.head) && summarySha(s.sha) && s.checkout === s.sha && summarySha(s.tree) && s.tree === s.checkoutTree, "CLEAN_CHECKOUT");
  const deploy = s.mode === "--production-source" || s.mode === "--dev-source";
  summaryNeed((s.profile === "production" ? ["--ci-route", "--production-source"] : ["--ci-route", "--dev-source"]).includes(s.mode), "MODE");
  const allowed = s.profile === "production" ? PRODUCTION_WORKFLOWS : { "Tennis Note Public PWA CI": WORKFLOWS[0], "Deploy Tennis Note development sites": WORKFLOWS[1] };
  summaryNeed(Object.hasOwn(allowed, s.workflow) && s.workflowSha === s.sha && s.workflowRef === REPOSITORY + "/" + allowed[s.workflow] + "@" + s.ref && s.refType === "branch", "WORKFLOW");
  summaryNeed(same(s.args, s.profile === "production" ? [s.mode, "--production"] : [s.mode, s.mode === "--dev-source" ? "--summary-layout" : "--checkout-mode"]), "ARGS");
  if (s.event === "pull_request") {
    summaryNeed(!deploy && s.mode === "--ci-route" && s.workflow === "Tennis Note Public PWA CI" && s.target === p.target && s.baseRepo === REPOSITORY && s.headRepo === REPOSITORY && s.number === s.prNumber && Number.isSafeInteger(s.number) && s.number > 0 && s.ref === "refs/pull/" + s.number + "/merge" && same(s.mergeParents, [p.base, s.head]), "PR");
  } else if (s.profile === "production") {
    summaryNeed(s.event === "push" && s.before === p.base && s.ref === "refs/heads/main" && s.head === s.sha && same(s.parents, [p.base]) && (deploy ? s.workflow !== "Tennis Note Public PWA CI" : s.workflow === "Tennis Note Public PWA CI"), "MAIN");
  } else summaryNeed(s.event === "workflow_dispatch" && s.mode === "--dev-source" && s.workflow === "Deploy Tennis Note development sites" && s.ref === "refs/heads/" + p.branch && s.input === s.head && s.head === s.sha, "DEV_DISPATCH");
  if (!(s.profile === "production" && s.event === "push")) {
    summaryNeed(s.parents.length === 1 && summarySha(s.parents[0]) && s.parents[0] !== p.base && same(s.sourceParents, [p.base]), "TWO_LAYERS");
    summaryNeed(same(s.sourceRows.map(r => r[1]).sort(), [...sourcePaths].sort()) && s.sourceRows.every(r => r.length === 2 && r[0] === "M"), "SOURCE_LAYER");
    summaryNeed(same(s.metadataRows.map(r => r[1]).sort(), [...METADATA].sort()) && s.metadataRows.every(r => r.length === 2 && r[0] === "M"), "METADATA_LAYER");
  }
}
export function summaryValidate(s) {
  summaryBoundary(s);
  const p = SUMMARY_PROFILES[s.profile];
  for (const path of SUMMARY_UI) summaryNeed(s.bodies[path] === summaryExpectedUi(path, s.originals[path]), "UI_BYTES");
  summaryNeed(summaryOriginal(s.bodies[SELF]) === s.originals[SELF] && summarySeal(s.bodies[SELF]) === SUMMARY_SEAL && /^[a-f0-9]{64}$/.test(SUMMARY_SEAL), "SELECTOR_INVERSE_SEAL");
  const marker = "\n// SUMMARY_LAYOUT_TEST_BEGIN\n", testBody = s.bodies[TEST];
  summaryNeed(testBody.split(marker).length === 2 && testBody.slice(0, testBody.indexOf(marker)) === s.originals[TEST] && hash(testBody.slice(testBody.indexOf(marker))) === SUMMARY_TEST_SUFFIX_HASH, "TEST_INVERSE");
  if (s.profile === "development") summaryNeed(false, "DEV_HELPER_NOT_YET_REVIEWED");
  if (s.event !== "local") {
    const release = JSON.parse(s.bodies["app/release.json"]), normalized = { ...release, memberCache: "tennis-note-member-pwa-v" + p.member, coachCache: "tennis-note-coach-mode-v" + p.coach };
    summaryNeed(release.version === p.version && release.appSurfaceVersion === p.version && /^2026\.10\.30\.[0-9]{2}$/.test(release.releaseId) && /^2026-10-30T/.test(release.deployedAt) && Number.isFinite(Date.parse(release.deployedAt)), "RELEASE");
    for (const path of METADATA) summaryNeed(s.bodies[path] === expectedMetadata(path, s.originals[path], normalized, p.previous), "METADATA_BYTES");
    if (!(s.profile === "production" && s.event === "push")) {
      for (const path of summaryPaths(s.profile)) summaryNeed(s.sourceBodies[path] === s.bodies[path], "SOURCE_UNCHANGED");
      for (const path of METADATA) summaryNeed(s.sourceBodies[path] === s.originals[path], "EARLY_METADATA");
    }
  }
  return { contract: "r3-summary-public-source/1", status: s.event === "local" ? "LOCAL_SOURCE_ONLY" : "SOURCE_PROVEN", head: s.event === "local" ? null : s.head, checkout: s.event === "local" ? null : s.checkout, tree: s.event === "local" ? null : s.tree, base: p.base, profile: s.profile, files: s.rows.length, databaseActions: 0, browserRuns: 0, deploymentAdmitted: false };
}
export function summaryRequested(args, env) {
  if (args.includes("--summary-layout")) return true;
  if (!env.GITHUB_EVENT_PATH) return false;
  const e = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  return Object.values(SUMMARY_PROFILES).some(p => e.pull_request?.head?.ref === p.branch || env.GITHUB_REF === "refs/heads/" + p.branch || env.GITHUB_EVENT_NAME === "push" && e.before === p.base);
}
export function summaryPacket(args) {
  const local = args[0] === "--local", env = process.env, e = local ? {} : JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  const branch = local ? git("branch", "--show-current") : e.pull_request?.head?.ref || env.GITHUB_REF?.replace("refs/heads/", "");
  const profile = Object.keys(SUMMARY_PROFILES).find(k => SUMMARY_PROFILES[k].branch === branch) || (e.before === SUMMARY_PROFILES.production.base ? "production" : null);
  summaryNeed(Boolean(profile), "BRANCH"); const p = SUMMARY_PROFILES[profile];
  const head = local ? p.base : e.pull_request?.head?.sha || env.GITHUB_SHA;
  const s = { profile, event: local ? "local" : env.GITHUB_EVENT_NAME, mode: args[0], args, branch: local || e.pull_request ? branch : p.branch, base: local ? p.base : e.pull_request?.base?.sha || (profile === "production" ? e.before : p.base), baseTree: git("rev-parse", p.base + "^{tree}"), head, sha: env.GITHUB_SHA, checkout: git("rev-parse", "HEAD"), repo: local ? REPOSITORY : env.GITHUB_REPOSITORY, attempt: local ? "1" : env.GITHUB_RUN_ATTEMPT, workflow: env.GITHUB_WORKFLOW, workflowRef: env.GITHUB_WORKFLOW_REF, workflowSha: env.GITHUB_WORKFLOW_SHA, ref: env.GITHUB_REF, refType: env.GITHUB_REF_TYPE, before: e.before, input: e.inputs?.candidate_sha,
    number: e.number, prNumber: e.pull_request?.number, target: e.pull_request?.base?.ref, baseRepo: e.pull_request?.base?.repo?.full_name, headRepo: e.pull_request?.head?.repo?.full_name, clean: git("status", "--porcelain", "--untracked-files=all") === "", indexEmpty: git("diff", "--cached", "--name-only") === "", modes: {}, bodies: {}, originals: {}, sourceBodies: {} };
  const delta = (a, b) => git("diff", "--no-renames", "--name-status", ...(b ? [a, b] : [])).split("\n").filter(Boolean).map(r => r.split("\t"));
  s.rows = local ? [...delta(), ...git("ls-files", "--others", "--exclude-standard").split("\n").filter(Boolean).map(v => ["A", v])] : delta(p.base, head);
  if (!local) {
    summaryNeed(summarySha(head) && summarySha(s.sha), "REF");
    s.parents = git("show", "-s", "--format=%P", head).split(" ").filter(Boolean);
    s.mergeParents = git("show", "-s", "--format=%P", s.sha).split(" ").filter(Boolean);
    s.tree = git("rev-parse", head + "^{tree}"); s.checkoutTree = git("rev-parse", s.checkout + "^{tree}");
    if (!(profile === "production" && s.event === "push")) {
      summaryNeed(s.parents.length === 1 && summarySha(s.parents[0]), "PARENT_REF");
      s.sourceParents = git("show", "-s", "--format=%P", s.parents[0]).split(" ").filter(Boolean);
      s.sourceRows = delta(p.base, s.parents[0]); s.metadataRows = delta(s.parents[0], head);
    }
  }
  for (const name of [...summaryPaths(profile), ...(local ? [] : METADATA)]) s.modes[name] = git("ls-tree", "--format=%(objectmode)", local ? p.base : head, "--", name);
  summaryBoundary(s); // 범위 검증 전 candidate body나 실행 모듈은 읽지 않습니다.
  const blob = (ref, name) => lf(execFileSync("git", ["show", ref + ":" + name], { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000, maxBuffer: 8000000 }));
  for (const name of [...summaryPaths(profile), ...METADATA]) {
    s.originals[name] = blob(p.base, name);
    let value = ROOT; summaryNeed(!lstatSync(ROOT).isSymbolicLink(), "ROOT");
    for (const part of name.split("/")) { value = resolve(value, part); summaryNeed(!lstatSync(value).isSymbolicLink(), "SYMLINK"); }
    summaryNeed(lstatSync(value).isFile(), "REGULAR"); s.bodies[name] = lf(readFileSync(value, "utf8"));
    if (!local) {
      summaryNeed(s.bodies[name] === blob(s.checkout, name), "WORKTREE");
      if (!(profile === "production" && s.event === "push")) s.sourceBodies[name] = blob(s.parents[0], name);
    } else if (METADATA.includes(name)) summaryNeed(s.bodies[name] === s.originals[name], "LOCAL_METADATA_UNCHANGED");
  }
  return s;
}
function summaryMain(args) {
  const initial = git("status", "--porcelain", "--untracked-files=all");
  const s = summaryPacket(args), proof = summaryValidate(s);
  // 새 이름만 실행합니다. 테스트는 pure 함수만 호출하며 이 CLI를 다시 실행하지 않습니다.
  // 기존 eager DEV fixture 로딩만 비활성화합니다. 과거 테스트/결과 flag는 선택하지 않습니다.
  const testOutput = execFileSync(process.execPath, ["--test", "--test-reporter=tap", "--test-name-pattern=^SUMMARY-LAYOUT:", TEST], { cwd: ROOT, encoding: "utf8", env: { ...process.env, R3_PRODUCTION_SELECTED: "1" }, stdio: ["ignore", "pipe", "pipe"], timeout: 30000, maxBuffer: 2000000 });
  const newBoundaryCases = Number(testOutput.match(/^# pass (\d+)$/m)?.[1]);
  summaryNeed(newBoundaryCases === 5 && /^# fail 0$/m.test(testOutput), "NEW_TEST_RECEIPT");
  summaryNeed(git("status", "--porcelain", "--untracked-files=all") === initial, "POST_STATE");
  if (args[0] === "--ci-route") appendFileSync(process.env.GITHUB_OUTPUT, "scoped=true\nsummary_source_only=true\n");
  console.log(JSON.stringify({ ...proof, newBoundarySuiteExecuted: true, newBoundaryCases, previousBrowser112Reused: true }));
}
// SUMMARY_LAYOUT_SUCCESSOR_END

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (summaryRequested(process.argv.slice(2), process.env)) { summaryMain(process.argv.slice(2)); } else {
    if (prodLegacyRequested(process.argv, process.env)) { prodLegacyMain(process.argv[2]); }
    else if(process.argv[3]==='--production'){productionMain(process.argv[2]);}
    else {
    const mode=process.argv[2],term=process.argv[3]==="--term-history";
    const checkout=process.argv[3]==="--checkout-mode";
    need(["--local","--ci-route","--dev-source"].includes(mode)&&process.argv.length===(term||checkout?4:3),"MODE");
    const proof=mode==="--local"?(checkout?localCheckoutOverlay():term?localTermOverlay():localOverlay()):verifyCheckout(context(process.env,JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,"utf8")),git("rev-parse","HEAD")),undefined,term,checkout);
    if(mode==="--dev-source")need(proof.admissionRoute===(checkout?"dev566-manual":term?"dev565-manual":"dev564-manual"),"DEV_ONLY");
    if(mode==="--ci-route"){need(proof.event==="pull_request","CI_PR_ONLY");appendFileSync(process.env.GITHUB_OUTPUT,checkout?"scoped=true\ncheckout_mode_only=true\n":term?"scoped=true\nterm_history_only=true\n":"scoped=true\npurchase_identity_only=true\n");}
    console.log(JSON.stringify(proof));
    }
    } // SUMMARY_ENTRY_END
  } catch { console.error("R3_PURCHASE_IDENTITY_HOLD"); process.exitCode = 2; }
}
