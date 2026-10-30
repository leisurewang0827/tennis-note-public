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
// 새 monthly source 연결만 판정합니다. 이전 후보/역사 fixture 계약은 그대로 둡니다.
export const LEGACY_BASE = "8cef5b40228c929693c31aaa8af2a089cb0262f4";
export const LEGACY_BASE_TREE = "d912835abe666f1ce6d83f88c5cd74e52f1bb767";
export const LEGACY_BRANCH = "codex/tennisnote-r3-legacy-monthly-public-20261029";
export const LEGACY_META = "tests/fixtures/r3-legacy-monthly-selected-source.json";
export const LEGACY_PATTERN = "^LEGACY-MONTHLY-GUARD:";
export const LEGACY_GUARD = "scripts/check_r3_dev_deployment.py";
export const LEGACY_READONLY = Object.freeze({"tests/fixtures/r3-dev-cache-floors.json":"a43b36b47a2c249d4e5a1cebe4ad403d95c66e63c950c5dbb7afbdb4eb6cc0b8"});
export const LEGACY_GUARD_HOOK = "        # LEGACY_MONTHLY_ENTRY_BEGIN\n        if legacy_monthly_claimed():\n            legacy_monthly_dispatch(args)\n            return 0\n        # LEGACY_MONTHLY_ENTRY_END\n";
export function legacyMonthlyOriginalGuard(s) {
  const begin="# LEGACY_MONTHLY_567_BEGIN\n",end="# LEGACY_MONTHLY_567_END\n\n\n";
  need(s.split(begin).length===2&&s.split(end).length===2,"LEGACY_GUARD_BLOCK");
  const start=s.indexOf(begin),stop=s.indexOf(end,start);
  need(stop>start,"LEGACY_GUARD_BLOCK");
  return once(once(s,s.slice(start,stop+end.length),""),LEGACY_GUARD_HOOK,"");
}
export const LEGACY_PRIVATE_SOURCE = Object.freeze({commit:"4d9e9aeaab972609f7260b3d7db068ce5708d7b9",tree:"0911d86a5b424c3037ec015e430ffdc04e14be95",productPins:{
  "90-Dashboard/shared/tennisnote-settlement-adjustment.js":"d55ca914171ce380eed3e3b35d7d363428170530518e2824175cce2d3e33deb2",
  "90-Dashboard/tennis-note-coach-app/app.js":"99f63e7d4761a6dab35a4ca29ad88d97d871a732f4db099049159d76f35e78f9",
  "90-Dashboard/tennis-note-prototype/app.js":"db67b05b7c0aa1c068435df021ca5f2c88c2de099b62c459b5d2dd63922e1a7f"
}});
export const LEGACY_RELEASE = Object.freeze({"version":"1.0.567","appSurfaceVersion":"1.0.567","releaseId":"2026.10.29.01","deployedAt":"2026-10-29T19:42:29+09:00","memberCache":"tennis-note-member-pwa-v600","coachCache":"tennis-note-coach-mode-v573"});
export const LEGACY_RELEASE_PINS = {
  "app/admin/index.html": "c31cefc00869cfddb7a9fbaa69ea716a86e1510c3adf5adca4feee9145c7fd55",
  "app/release.json": "63737c980d6d73c8131c84a446db4510ffb48362ba5427c6b5741304abfe6c3a",
  "app/shared/tennisnote-release.js": "4258cff47f8080f0c5adea86187308ca14c549367e0699795c305a246f5f129a",
  "app/tennis-note-coach-app/app.js": "31ea4fd96445f2bfaa361f67ad098d4fa0d03a99f5ff07520d96c793f8c5c8d6",
  "app/tennis-note-coach-app/domain/coaches.js": "caa4f52bf525b1f2c44289665c1a6364f29d90a416a5955bcb23529549269145",
  "app/tennis-note-coach-app/forms/common.js": "df6fa7a4a9afeb60aa87aa2e97d0829df8ca0e16a166237182499f1d27b75dc3",
  "app/tennis-note-coach-app/index.html": "4a24599f49db0b525243084483108a287562c21456e468702caeeab59512aab9",
  "app/tennis-note-coach-app/service-worker.js": "80e227f5a522d6b808752691da10f95ebdb3563c1f60cb485b62cfbf9216eef8",
  "app/tennis-note-member-app/app.js": "6c88d590b9de4a772d3224039014be6ccd5d283cb7c109d81731116c768bdbbd",
  "app/tennis-note-member-app/forms/common.js": "76c5969fe5f123898b5cc974856dd2daea986556040b595074e64a9eb2e62727",
  "app/tennis-note-member-app/index.html": "237ee961a82b577d44aa48de412dece30e712efa89e195d27b59edaa1362eee6",
  "app/tennis-note-member-app/service-worker.js": "58c9fcf2bb4b4f45467c4d0f52d8434cfa492955d1e2392abf51b8147fa60b46",
  "app/tennis-note-member-app/ui/screens.js": "4b7e9d9acb8407581f6ee0c7f4513bbc387681db7be84d3401f89f830fe3e70f"
};
export const LEGACY_SELF_SEAL = "79d4f876854453623e00e1ad0dcc78e16b80096f1f017668b7943f4e111b7c1b";
export const LEGACY_PRODUCT_PINS = {
  "app/admin/actions/billing.js": "48c6cd5b96e8a61300ca9adfaecb9258d6d31d88018008db7819399cbd88a185",
  "app/admin/views/billing.js": "cc7df735c1ab10cb6dfa5c19ec2383622a33d693b9b090b2c91192c4cb9a9b52",
  "app/shared/tennisnote-settlement-adjustment.js": "d55ca914171ce380eed3e3b35d7d363428170530518e2824175cce2d3e33deb2",
  "app/tennis-note-coach-app/domain/settlement.js": "5c50ba3a7375fe083fbcbdf0c987a0efc1d9644c4f5853a8d2762f9fa9604adb",
  "app/tennis-note-coach-app/views/settlement.js": "2f225c94f707d0779d1de3fa4496b1e120f7bd46d3cbfdbf9383d922b97a9b86"
};
export const LEGACY_TOOL_PINS = {
  "scripts/check_r3_dev_deployment.py": "8a87963ab9f53da4942c00e3a2f17c97c94771d3a637911942251beed61ddb46",
  ".github/workflows/tennisnote-public-ci.yml": "724d5652aea42b94cf04a1b073fb4b653a1ca5359402f28d0066a4a26faaf144",
  "tests/r3-purchase-identity-admission.test.mjs": "214087e547abcc1e1e88bbf5d34c46c3fcac71500ee0946e71cdf1569c370d40",
  "tests/fixtures/r3-legacy-monthly-selected-source.json": "201cad67910c76c50c4a0fc71928d5dcf4c9643e6cb496509077cec0518bc5af",
  "scripts/verify.sh": "5c04e60b4cbbf0aa13812dc6ead3d10d213ac705a2c26f65a716cbefae12e54f"
};
export const LEGACY_SOURCE_PATHS = [...Object.keys(LEGACY_PRODUCT_PINS), ...Object.keys(LEGACY_TOOL_PINS), SELF].sort();
export const LEGACY_PATHS = [...LEGACY_SOURCE_PATHS, ...Object.keys(LEGACY_RELEASE_PINS)].sort();
export const LEGACY_MODE_MAP = Object.freeze(Object.fromEntries(LEGACY_PATHS.map(p=>[p,p==="scripts/verify.sh"?"100755":"100644"])));
export const legacyMonthlySeal = s => hash(lf(s).replace(/export const LEGACY_SELF_SEAL = "[^"]+";/, 'export const LEGACY_SELF_SEAL = "PENDING";'));
export function legacyMonthlyClaimed(env, event) {
  return String(event.pull_request?.head?.ref || "").startsWith("codex/tennisnote-r3-legacy-monthly-")
    || String(env.GITHUB_REF || "").startsWith("refs/heads/codex/tennisnote-r3-legacy-monthly-")
    || (env.GITHUB_EVENT_NAME === "push" && event.before === LEGACY_BASE);
}
export function legacyMonthlyContext(env, event, checkout) {
  return {...context(env, event, checkout), base:event.pull_request?.base?.sha || event.before,
    number:event.number, prNumber:event.pull_request?.number, baseRepo:event.pull_request?.base?.repo?.full_name};
}
export function legacyMonthlyIO() {
  const allow = p => need(LEGACY_PATHS.includes(p)||Object.hasOwn(LEGACY_READONLY,p), "LEGACY_READ_OUTSIDE_SCOPE");
  return {
    tree:r=>git("rev-parse", r+"^{tree}"),
    parents:r=>git("show","-s","--format=%P",r).split(" ").filter(Boolean),
    changes:(b,h)=>git("diff","--no-renames","--name-status",b,h).split("\n").filter(Boolean).map(s=>s.split("\t")),
    mode:(r,p)=>{allow(p);return git("ls-tree","--format=%(objectmode)",r,"--",p);},
    blob:(r,p)=>{allow(p);return lf(execFileSync("git",["show",r+":"+p],{cwd:ROOT,encoding:"utf8",stdio:["ignore","pipe","pipe"],timeout:15000,maxBuffer:2000000}));},
    read:p=>{
      allow(p);let current=ROOT;
      for(const part of p.split("/")){current=resolve(current,part);need(!lstatSync(current).isSymbolicLink(),"LEGACY_SYMLINK");}
      need(lstatSync(current).isFile(),"LEGACY_REGULAR_FILE");
      return lf(readFileSync(current,"utf8"));
    }
  };
}
export function proveLegacyMonthlyTree(ref, io) {
  need(/^[0-9a-f]{40}$/.test(ref||"") && ref!==LEGACY_BASE,"LEGACY_REFS");
  need(io.tree(LEGACY_BASE)===LEGACY_BASE_TREE,"LEGACY_BASE");
  const parents=io.parents(ref);
  need(parents.length===1,"LEGACY_PARENT");
  const source=parents[0]===LEGACY_BASE?ref:parents[0];
  if(source!==ref)need(same(io.parents(source),[LEGACY_BASE]),"LEGACY_TWO_LAYERS");
  const changes=io.changes(LEGACY_BASE,ref);
  need(same(changes.map(r=>r[1]).sort(),LEGACY_PATHS)
    &&changes.every(r=>r.length===2&&r[0]===(r[1]===LEGACY_META?"A":"M")),"LEGACY_EXACT_PATHS");
  if(source!==ref){
    const first=io.changes(LEGACY_BASE,source),second=io.changes(source,ref);
    need(same(first.map(r=>r[1]).sort(),LEGACY_SOURCE_PATHS)
      &&first.every(r=>r.length===2&&r[0]===(r[1]===LEGACY_META?"A":"M"))
      &&same(second.map(r=>r[1]).sort(),Object.keys(LEGACY_RELEASE_PINS).sort())
      &&second.every(r=>r.length===2&&r[0]==="M"),"LEGACY_LAYER_PATHS");
  }
  const blobs={};
  for(const [p,pin] of Object.entries(LEGACY_READONLY)){
    need(io.mode(LEGACY_BASE,p)==="100644"&&io.mode(ref,p)==="100644","LEGACY_DEPENDENCY_MODE");
    const original=io.blob(LEGACY_BASE,p);
    need(hash(original)===pin&&io.blob(ref,p)===original&&io.read(p)===original,"LEGACY_IMMUTABLE_DEPENDENCY");
  }
  for(const p of LEGACY_PATHS){
    need(io.mode(ref,p)===LEGACY_MODE_MAP[p]&&io.mode(LEGACY_BASE,p)===(p===LEGACY_META?"":LEGACY_MODE_MAP[p]),"LEGACY_MODE");
    const s=io.blob(ref,p);
    need(p===SELF?legacyMonthlySeal(s)===LEGACY_SELF_SEAL:hash(s)===(LEGACY_PRODUCT_PINS[p]||LEGACY_TOOL_PINS[p]||LEGACY_RELEASE_PINS[p]),"LEGACY_CONTENT_PIN");
    need(io.read(p)===s,"LEGACY_WORKTREE_BYTES");blobs[p]=s;
    if(source!==ref){
      need(io.mode(source,p)===LEGACY_MODE_MAP[p],"LEGACY_SOURCE_MODE");
      need(io.blob(source,p)===(Object.hasOwn(LEGACY_RELEASE_PINS,p)?io.blob(LEGACY_BASE,p):s),"LEGACY_LAYER_BYTES");
    }
    if(Object.hasOwn(LEGACY_RELEASE_PINS,p))need(s===expectedMetadata(p,io.blob(LEGACY_BASE,p),LEGACY_RELEASE,"1.0.559"),"LEGACY_METADATA_ONLY");
    if(p===LEGACY_GUARD)need(legacyMonthlyOriginalGuard(s)===io.blob(LEGACY_BASE,p),"LEGACY_HISTORIC_GUARD_BYTES");
  }
  const f=JSON.parse(blobs[LEGACY_META]),provenance=f.privateSource||{};
  need(f.contract==="r3-legacy-monthly-selected-source/1"&&f.base===LEGACY_BASE&&f.baseTree===LEGACY_BASE_TREE&&f.branch===LEGACY_BRANCH
    &&f.candidateCommit===null&&same(f.productPaths,Object.keys(LEGACY_PRODUCT_PINS).sort())
    &&same(f.connectionPaths,[SELF,...Object.keys(LEGACY_TOOL_PINS)].sort()),"LEGACY_METADATA");
  need(provenance.base==="32bf1d3741f6ed02374d0294af7c9c4a7efb6c98"
    &&provenance.baseTree==="a2129b8834febb771902b39a333f43a972ca0a7c"
    &&provenance.migrationSha256==="dcf5e719a2b9726686ebf95f63df32e513c2f36d437f0cb60d1298ac854e4e57"
    &&provenance.commit===LEGACY_PRIVATE_SOURCE.commit&&provenance.tree===LEGACY_PRIVATE_SOURCE.tree
    &&same(provenance.productPins,LEGACY_PRIVATE_SOURCE.productPins)&&f.status==="BOUND_PRIVATE_SOURCE","LEGACY_PRIVATE_BINDING");
  need(f.releaseLayer.status==="PREPARED_LOCAL_NOT_DEPLOY_ADMITTED"
    &&same(f.releaseLayer.changedPaths,Object.keys(LEGACY_RELEASE_PINS).sort())
    &&["version","releaseId","memberCache","coachCache"].every(k=>f.releaseLayer[k]===LEGACY_RELEASE[k])
    &&f.releaseLayer.preservedDeployedDevSource==="2c6eba698c3eaf0bced8352d0b234d463e4689e6","LEGACY_RELEASE_LAYER");
  return {status:"SOURCE_PROVEN",privateSourceBound:true,privateSource:LEGACY_PRIVATE_SOURCE,base:LEGACY_BASE,
    head:ref,tree:io.tree(ref),sourceCommit:source,layers:source===ref?1:2,files:LEGACY_PATHS.length,
    release:LEGACY_RELEASE,immutableDependencies:Object.keys(LEGACY_READONLY).length,databaseActions:0,oldChecksRepeated:0,deploymentAdmitted:false};
}
export function proveLegacyMonthlySource(c, io) {
  need(c.repo===REPOSITORY && c.attempt==="1" && c.workflow==="Tennis Note Public PWA CI","LEGACY_CONTEXT");
  need(c.workflowSha===c.sha && c.workflowRef===REPOSITORY+"/.github/workflows/tennisnote-public-ci.yml@"+c.ref,"LEGACY_WORKFLOW");
  need([c.head,c.sha,c.checkout,c.base].every(s=>/^[0-9a-f]{40}$/.test(s||"")),"LEGACY_REFS");
  need(c.base===LEGACY_BASE && io.tree(c.base)===LEGACY_BASE_TREE,"LEGACY_BASE");
  need(c.head!==c.base,"LEGACY_REFS");
  if(c.event==="pull_request"){
    need(Number.isSafeInteger(c.number)&&c.number>0&&c.prNumber===c.number&&c.ref==="refs/pull/"+c.number+"/merge"
      && c.target==="main"&&c.headRef===LEGACY_BRANCH&&c.headRepo===REPOSITORY&&c.baseRepo===REPOSITORY,"LEGACY_PR");
    need(c.checkout===c.sha&&same(io.parents(c.checkout),[c.base,c.head])&&io.tree(c.checkout)===io.tree(c.head),"LEGACY_MERGE");
  }else{
    need(c.event==="push"&&c.ref==="refs/heads/main"&&c.refType==="branch"
      &&c.sha===c.head&&c.checkout===c.head,"LEGACY_MAIN");
  }
  return {...proveLegacyMonthlyTree(c.head,io),checkout:c.checkout,event:c.event};
}
export function runLegacyMonthlyCi(env,event,host,writeOutput) {
  need(legacyMonthlyClaimed(env,event),"LEGACY_NOT_CLAIMED");
  need(host.status()==="","LEGACY_DIRTY");
  const proof=proveLegacyMonthlySource(legacyMonthlyContext(env,event,host.checkout()),host.io);
  need(proof.privateSourceBound,"LEGACY_NOT_ADMITTED_PRIVATE_COMMIT_BINDING_PENDING");
  writeOutput("scoped=true\nlegacy_monthly_only=true\n");
  return proof;
}
export function proveLegacyMonthlyDev(c,io) {
  const ref="refs/heads/"+LEGACY_BRANCH;
  need(c.repo===REPOSITORY&&c.attempt==="1"&&c.event==="workflow_dispatch"&&c.workflow==="Deploy Tennis Note development sites"
    &&c.ref===ref&&c.refType==="branch"
    &&c.workflowRef===REPOSITORY+"/.github/workflows/deploy-cloudflare-pages-dev.yml@"+ref
    &&c.sha===c.head&&c.head===c.checkout&&c.input===c.head&&c.workflowSha===c.sha,"LEGACY_DEV_CONTEXT");
  const proof=proveLegacyMonthlyTree(c.head,io);
  need(proof.layers===2,"LEGACY_DEV_TWO_ACTUAL_COMMITS");
  return {...proof,checkout:c.checkout,admissionRoute:"legacy-monthly-dev567-manual"};
}
export function runLegacyMonthlyDev(env,event,host) {
  need(legacyMonthlyClaimed(env,event),"LEGACY_NOT_CLAIMED");
  need(host.status()==="","LEGACY_DIRTY");
  return proveLegacyMonthlyDev(legacyMonthlyContext(env,event,host.checkout()),host.io);
}
function legacyMonthlyMain(mode) {
  need(["--ci-route","--dev-source"].includes(mode)&&process.argv.length===4&&process.argv[3]==="--legacy-monthly","LEGACY_MODE");
  const event=JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,"utf8"));
  const host={status:()=>git("status","--porcelain","--untracked-files=all"),checkout:()=>git("rev-parse","HEAD"),io:legacyMonthlyIO()};
  const proof=mode==="--dev-source"?runLegacyMonthlyDev(process.env,event,host):
    runLegacyMonthlyCi(process.env,event,host,s=>appendFileSync(process.env.GITHUB_OUTPUT,s));
  console.log(JSON.stringify(proof));
}


// SUMMARY_LAYOUT_SUCCESSOR_BEGIN
// 승인된 표시 hunk와 공식 버전층만 받습니다. 과거 source/검사 봉인은 그대로 보존합니다.
export const SUMMARY_PROFILES = {
  production: { base: "345d42765c6e786446e6cbb7eb1a03568665b15f", tree: "e4946727ac0ab3dc02524894914781416db260e7", branch: "codex/tennisnote-coach-settlement-summary-prod561-20261030", target: "main", previous: "1.0.560", version: "1.0.561", member: 594, coach: 567 },
  development: { base: "a5503e5855d0b30e34e4992976e6303342c40f9b", tree: "39b6b126b7095ca4fde7c7d20851396d3a6832df", branch: "codex/tennisnote-coach-settlement-summary-dev568-20261030", target: "codex/tennisnote-r3-legacy-monthly-public-20261029", previous: "1.0.567", version: "1.0.568", member: 601, coach: 574 },
};
export const SUMMARY_UI = ["app/tennis-note-coach-app/views/settlement.js", "app/tennis-note-coach-app/styles.css"];
export const SUMMARY_SEAL = "f3756600f2add55d346a2bddca19947dfac6dfc0efcae1f4be4b69eefc1e95aa";
export const SUMMARY_TEST_SUFFIX_HASH = "4c917035e52e801b2bb8b5222207140f47f90a3d95ad39e35f0135409042d4c5";
export const SUMMARY_DEV_HELPER_HASH = "c7b75eb88334aa79b1b1976a0639428ccd673f276cb2b68969ee003e031ec4d3";
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
export function summaryHelperOriginal(source) {
  source = lf(source);
  const begin = "# SUMMARY_LAYOUT_568_BEGIN\n", end = "# SUMMARY_LAYOUT_568_END\n\n\n";
  summaryNeed(source.split(begin).length === 2 && source.split(end).length === 2, "HELPER_MARKERS");
  const a = source.indexOf(begin), b = source.indexOf(end);
  source = source.slice(0, a) + source.slice(b + end.length);
  const entry = "        # SUMMARY_LAYOUT_ENTRY_BEGIN\n        if summary_layout_claimed():\n            summary_layout_dispatch(args)\n            return 0\n        # SUMMARY_LAYOUT_ENTRY_END\n";
  return once(source, entry, "");
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
// ROW_SCOPE_PACKET_BEGIN: 이 경계는 소스 수집만 하며 배포 승인이 아닙니다.
export const ROW_SCOPE_BASE = "d4ee449afcc5f442e5e98cc2792bff87146bffd1";
export const ROW_SCOPE_BASE_TREE = "bc4ecf04a445e8be89f831c67c306b390ecaf33f";
export const ROW_SCOPE_BRANCH = "codex/tennisnote-r3-substitute-row-scope-dev569-20261030";
export const ROW_SCOPE_NEW = Object.freeze([
  "tests/r3-substitute-policy-row-scope.test.cjs",
  "tests/fixtures/r3-substitute-policy-private-reviewed.fragment.js",
]);
export const ROW_SCOPE_MODIFIED = Object.freeze([
  "app/admin/data/billing.js", "app/admin/actions/billing.js", "app/admin/views/billing.js",
  "scripts/verify.sh", "scripts/check_r3_purchase_identity_admission.mjs",
  "scripts/check_r3_dev_deployment.py", ".github/workflows/tennisnote-public-ci.yml",
]);
const rowScopeNeed = (value, code) => { if (!value) throw Error("ROW_SCOPE_" + code); };
const rowScopeId = (value) => typeof value === "string" && /^[a-f0-9]{40}$/.test(value) && !/^0+$/.test(value);
const rowScopeSame = (a, b) => Array.isArray(a) && a.length === b.length && a.every((v, i) => v === b[i]);
function rowScopeRows(rows, paths, newPaths) {
  rowScopeNeed(Array.isArray(rows) && rows.length === paths.length, "PATH_COUNT");
  const byPath = new Map();
  for (const row of rows) {
    rowScopeNeed(row && typeof row.path === "string" && !byPath.has(row.path) && paths.includes(row.path), "PATH");
    const isNew = newPaths.includes(row.path);
    rowScopeNeed(row.status === (isNew ? "A" : "M"), "STATUS");
    rowScopeNeed(row.baseMode === (isNew ? "" : row.path === "scripts/verify.sh" ? "100755" : "100644"), "BASE_MODE");
    const mode = row.path === "scripts/verify.sh" ? "100755" : "100644";
    rowScopeNeed(row.sourceMode === mode && row.headMode === mode, "MODE");
    byPath.set(row.path, row);
  }
  rowScopeNeed(paths.every((path) => byPath.has(path)), "MISSING_PATH");
}
export function rowScopeCiContext(p) {
  const baseBranch = "codex/tennisnote-coach-settlement-summary-dev568-20261030";
  rowScopeNeed(p && p.event === "pull_request" && p.repo === REPOSITORY && p.eventRepo === REPOSITORY && p.headRepo === REPOSITORY && p.baseRepo === REPOSITORY, "CI_REPOSITORY");
  rowScopeNeed(p.baseRef === baseBranch && p.baseSha === ROW_SCOPE_BASE && p.headRef === ROW_SCOPE_BRANCH, "CI_BRANCH");
  rowScopeNeed(rowScopeId(p.featureHead) && rowScopeId(p.mergeHead) && p.featureHead !== p.mergeHead, "CI_SHA");
  rowScopeNeed(Number.isSafeInteger(p.number) && p.number > 0 && p.eventNumber === p.number, "CI_NUMBER");
  const ref = "refs/pull/" + p.number + "/merge";
  rowScopeNeed(p.ref === ref && p.refType === "branch" && p.attempt === "1" && p.checkoutBranch === "", "CI_REF");
  rowScopeNeed(p.workflow === "Tennis Note Public PWA CI" && p.workflowRef === REPOSITORY + "/.github/workflows/tennisnote-public-ci.yml@" + ref, "CI_WORKFLOW");
  rowScopeNeed(p.workflowSha === p.mergeHead && p.githubSha === p.mergeHead && p.checkout === p.mergeHead, "CI_CHECKOUT");
  rowScopeNeed(rowScopeSame(p.mergeParents, [ROW_SCOPE_BASE, p.featureHead]), "CI_MERGE_PARENTS");
  rowScopeNeed(rowScopeId(p.featureTree) && p.mergeTree === p.featureTree, "CI_MERGE_TREE");
  return { status: "CI_CONTEXT_ONLY_NOT_ADMITTED", featureHead: p.featureHead, checkout: p.checkout };
}
export function rowScopeDevContext(p) {
  const ref = "refs/heads/" + ROW_SCOPE_BRANCH;
  rowScopeNeed(p && p.event === "workflow_dispatch" && p.repo === REPOSITORY && p.eventRepo === REPOSITORY, "DEV_REPOSITORY");
  rowScopeNeed(p.ref === ref && p.refType === "branch" && p.attempt === "1" && p.checkoutBranch === "", "DEV_REF");
  rowScopeNeed(p.workflow === "Deploy Tennis Note development sites"
    && p.workflowRef === REPOSITORY + "/.github/workflows/deploy-cloudflare-pages-dev.yml@" + ref, "DEV_WORKFLOW");
  rowScopeNeed(rowScopeId(p.head) && p.input === p.head && p.githubSha === p.head && p.workflowSha === p.head
    && p.checkout === p.head, "DEV_HEAD");
  return { status: "DEV_CONTEXT_ONLY_NOT_ADMITTED", head: p.head, checkout: p.checkout };
}
export function rowScopeBoundary(s) {
  rowScopeNeed(s && s.repo === REPOSITORY && s.branch === ROW_SCOPE_BRANCH, "IDENTITY");
  rowScopeNeed(s.base === ROW_SCOPE_BASE && s.baseTree === ROW_SCOPE_BASE_TREE, "BASE");
  rowScopeNeed(s.clean === true && s.indexClean === true && s.symlinks === false, "WORKTREE");
  rowScopeNeed(rowScopeId(s.head) && rowScopeId(s.source) && s.head !== s.source && s.head !== s.base, "COMMIT");
  if (s.ci) {
    const proof = rowScopeCiContext(s.ci);
    rowScopeNeed(proof.featureHead === s.head && proof.checkout === s.checkout && s.ci.featureTree === s.headTree, "CI_BOUNDARY");
  } else if (s.dev) {
    const proof = rowScopeDevContext(s.dev);
    rowScopeNeed(proof.head === s.head && proof.checkout === s.checkout, "DEV_BOUNDARY");
  } else rowScopeNeed(s.checkout === s.head, "CHECKOUT");
  rowScopeNeed(rowScopeSame(s.headParents, [s.source]) && rowScopeSame(s.sourceParents, [s.base]), "TWO_LAYERS");
  rowScopeNeed(rowScopeId(s.headTree) && rowScopeId(s.sourceTree), "TREE");
  rowScopeRows(s.sourceRows, [...ROW_SCOPE_MODIFIED, ...ROW_SCOPE_NEW], ROW_SCOPE_NEW);
  rowScopeRows(s.metadataRows, METADATA, []);
  const all = [...s.sourceRows, ...s.metadataRows].map((row) => row.path);
  rowScopeNeed(new Set(all).size === all.length, "OVERLAPPING_LAYERS");
  return { status: "BOUNDARY_ONLY_NOT_ADMITTED", sourceFiles: s.sourceRows.length, metadataFiles: s.metadataRows.length };
}
export function rowScopePacket(root, head) {
  rowScopeNeed(resolve(root) === ROOT && rowScopeId(head), "ROOT_OR_HEAD");
  const env = { ...process.env, GIT_NO_LAZY_FETCH: "1" };
  const call = (...args) => execFileSync("git", args, { cwd: ROOT, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000, maxBuffer: 8 * 1024 * 1024 }).trimEnd();
  const clean = call("status", "--porcelain", "--untracked-files=all") === "";
  const indexClean = call("diff", "--cached", "--name-only") === "";
  rowScopeNeed(clean && indexClean, "DIRTY");
  const checkout = call("rev-parse", "HEAD"), actualBranch = call("branch", "--show-current");
  let ci = null, dev = null, branch = actualBranch;
  if (env.GITHUB_EVENT_NAME === "pull_request") {
    rowScopeNeed(typeof env.GITHUB_EVENT_PATH === "string" && env.GITHUB_EVENT_PATH.length > 0, "CI_EVENT_PATH");
    const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8")), pr = event.pull_request || {};
    const mergeParents = call("show", "-s", "--format=%P", checkout).split(" ").filter(Boolean);
    ci = { event: env.GITHUB_EVENT_NAME, repo: env.GITHUB_REPOSITORY, eventRepo: event.repository?.full_name, headRepo: pr.head?.repo?.full_name,
      baseRepo: pr.base?.repo?.full_name, baseRef: pr.base?.ref, baseSha: pr.base?.sha, headRef: pr.head?.ref,
      featureHead: pr.head?.sha, mergeHead: checkout, githubSha: env.GITHUB_SHA, workflowSha: env.GITHUB_WORKFLOW_SHA,
      workflow: env.GITHUB_WORKFLOW, workflowRef: env.GITHUB_WORKFLOW_REF, ref: env.GITHUB_REF, refType: env.GITHUB_REF_TYPE,
      number: pr.number, eventNumber: event.number, attempt: env.GITHUB_RUN_ATTEMPT, checkout, checkoutBranch: actualBranch,
      mergeParents, mergeTree: call("rev-parse", checkout + "^{tree}"), featureTree: call("rev-parse", head + "^{tree}") };
    rowScopeCiContext(ci);
    rowScopeNeed(ci.featureHead === head && env.GITHUB_HEAD_REF === ci.headRef && env.GITHUB_BASE_REF === ci.baseRef, "CI_EVENT_BINDING");
    branch = ci.headRef;
  } else if (env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    rowScopeNeed(typeof env.GITHUB_EVENT_PATH === "string" && env.GITHUB_EVENT_PATH.length > 0, "DEV_EVENT_PATH");
    const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
    dev = { event: env.GITHUB_EVENT_NAME, repo: env.GITHUB_REPOSITORY, eventRepo: event.repository?.full_name,
      ref: env.GITHUB_REF, refType: env.GITHUB_REF_TYPE, attempt: env.GITHUB_RUN_ATTEMPT, checkoutBranch: actualBranch,
      workflow: env.GITHUB_WORKFLOW, workflowRef: env.GITHUB_WORKFLOW_REF, workflowSha: env.GITHUB_WORKFLOW_SHA,
      githubSha: env.GITHUB_SHA, input: event.inputs?.candidate_sha, head, checkout };
    rowScopeDevContext(dev);
    branch = ROW_SCOPE_BRANCH;
  } else rowScopeNeed(checkout === head && actualBranch === ROW_SCOPE_BRANCH, "CHECKOUT");
  const headParents = call("show", "-s", "--format=%P", head).split(" ").filter(Boolean);
  rowScopeNeed(headParents.length === 1 && rowScopeId(headParents[0]), "HEAD_PARENT");
  const source = headParents[0], sourceParents = call("show", "-s", "--format=%P", source).split(" ").filter(Boolean);
  const delta = (a, b) => call("diff", "--no-renames", "--name-status", a, b).split("\n").filter(Boolean).map((line) => {
    const parts = line.split("\t"); rowScopeNeed(parts.length === 2, "DELTA_FORMAT");
    return { status: parts[0], path: parts[1] };
  });
  const sourceRows = delta(ROW_SCOPE_BASE, source), metadataRows = delta(source, head);
  const allowed = [...ROW_SCOPE_MODIFIED, ...ROW_SCOPE_NEW, ...METADATA];
  rowScopeNeed([...sourceRows, ...metadataRows].every((row) => allowed.includes(row.path)), "OUTSIDE_SCOPE");
  const mode = (ref, path) => call("ls-tree", "--format=%(objectmode)", ref, "--", path);
  let symlinks = lstatSync(ROOT).isSymbolicLink();
  for (const row of [...sourceRows, ...metadataRows]) {
    row.baseMode = mode(ROW_SCOPE_BASE, row.path); row.sourceMode = mode(source, row.path); row.headMode = mode(head, row.path);
    let current = ROOT;
    for (const part of row.path.split("/")) { current = resolve(current, part); symlinks ||= lstatSync(current).isSymbolicLink(); }
    rowScopeNeed(lstatSync(current).isFile(), "NOT_FILE");
  }
  const s = { repo: REPOSITORY, branch, base: ROW_SCOPE_BASE, baseTree: call("rev-parse", ROW_SCOPE_BASE + "^{tree}"),
    head, source, checkout, headParents, sourceParents, headTree: call("rev-parse", head + "^{tree}"),
    sourceTree: call("rev-parse", source + "^{tree}"), clean, indexClean, symlinks, sourceRows, metadataRows, ci, dev };
  rowScopeBoundary(s); // allowlist/mode 검사 전에는 후보 파일 본문을 읽지 않습니다.
  const read = (ref, path) => execFileSync("git", ["show", ref + ":" + path], { cwd: ROOT, env, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 15000, maxBuffer: 8 * 1024 * 1024 });
  const bodies = {};
  for (const row of [...sourceRows, ...metadataRows]) bodies[row.path] = {
    base: row.baseMode ? read(ROW_SCOPE_BASE, row.path) : null,
    source: read(source, row.path), head: read(head, row.path),
  };
  rowScopeNeed(call("status", "--porcelain", "--untracked-files=all") === "" && call("diff", "--cached", "--name-only") === ""
    && call("rev-parse", "HEAD") === checkout && call("branch", "--show-current") === actualBranch, "POST_STATE");
  return { ...s, bodies, status: "ROW_SCOPE_PACKET_COLLECTED_NOT_ADMITTED" };
}
// ROW_SCOPE_BODY_B2A_BEGIN
export const ROW_SCOPE_BODY_SEAL = "211a150baed217f4b707735b8c2869f8f51ea5e26f92177d111f684b48788432";
export const ROW_SCOPE_TEST_PIN = "390ca9a8d29d4776d02228f614c0ed7484a2595595d598e5b88e6e7d37d1d2b3";
export const ROW_SCOPE_WORKFLOW_PIN = "2350d4cc5f7fb565894da4be9958e7df8fa1aa1c8938bdeabba0f127c80b79a0";
export const ROW_SCOPE_CALLBACK_PINS = [
  [
    "local event parser retains numeric data-r3 names used by the real renderer",
    "2d6fdfdb8e24e821596d733d2e8713455c939f2f3a2eb8763ef75e4f6cd457f8"
  ],
  [
    "canonical item without coachRoleId is tagged only from validated envelope, without mutation",
    "3be886ee4b4e1e59cb1cf6465ddf69bc6628943af279a7cbaace3c3019d21f97"
  ],
  [
    "scoped preview and confirm preserve exact assignment/source/revision/operation",
    "a2fb0dda4c6c7f1429c4dfb34ad08b939277b607861c2a523bec7bae4b68a84e"
  ],
  [
    "same assignment under both coaches resolves chosen row, not an arbitrary flattened match",
    "ed8df2b7b243eb61c8e553c6393d8aef36f3cfc4d8763758b1d39df8cb48998c"
  ],
  [
    "duplicate within one row and missing or wrong row never call preview",
    "a97869011204f2da2251d2ac026ac3466bd23dded2075e57c88ad5a73667b65e"
  ],
  [
    "wrong branch/month, invalid actor, loading and busy remain fail closed",
    "32506b6eeece7ea094474e9a80da363bf6ca5451f08b71a0ea7f244adb8ac601"
  ],
  [
    "stale source/revision, changed month or role after preview blocks confirmation",
    "3a60cb62f133b9d1989df849fdc217e024d43cad3feab28dcb0b9138005a5ac0"
  ],
  [
    "gate OFF, chosen decision, invalid recipient and busy cannot confirm",
    "7466187cedec9bfbfe96606580a490c975b7f11c6f75c50ae4da04650120222c"
  ],
  [
    "a stale or wrong preview response never creates a chooser",
    "52e322e31812fe07b3facf7d617c14b86e336f8c98c0974ef75959398f8d50e0"
  ],
  [
    "double click while preview pending issues exactly one read RPC",
    "efd0c62e9722cefd37b3c3f39754c1f51681cdb15b28fee3c2def347ba2de121"
  ],
  [
    "actual renderer binds the second row and only its exact chooser, preserving rerender/back safety",
    "0849709a15f7c139315b2de6e7ff1f7ccd4ee17bd000441df234c493d94bb56b"
  ],
  [
    "tampered chooser row or assignment cannot mutate recipient or call save",
    "8affbb935be1637b4d3ccf5cacac085ff89c65e0bed47e7fd0e4efb508ca4c1f"
  ],
  [
    "response loss retains exact operation key for same payload without forced local success",
    "3d4a1457766a62f86d53019bb445ac78aef0029140b5c2f9556922cebcd61a98"
  ],
  [
    "private canonical fragment and modular candidate use the same repaired functions",
    "e85fd18853731e1f6acfaa00a1300e22e7ff0f0fe5136de78d8f56e0eabd9ee7"
  ],
  [
    "server gate rejection retains exact scoped operation and never reports local success",
    "c469bbd00ceb2e704b910b78ff3a78dbec9d77c0cbcd38916fa19da073ead385"
  ],
  [
    "wrong server preview branch, lesson revision or actual role cannot bind a decision",
    "3b3de3c79b591cbf86463742c122bf9f527b1cfe89fdee79836a1acfbc05f6bb"
  ],
  [
    "switching coach rows removes prior controls rather than saving an arbitrary duplicate",
    "0bef4f413f08275f08314d6560ca67d892b6b2c7b82e214f01c365c8530e5c96"
  ]
];
const rowScopeBodyHash = (value) => createHash("sha256").update(value.replace(/\r\n/g, "\n")).digest("hex");
const rowScopeLf = (value) => { rowScopeNeed(typeof value === "string", "BODY"); return value.replace(/\r\n/g, "\n"); };
function rowScopeRemoveBlock(text, begin, end) {
  const start = text.indexOf(begin), finish = text.indexOf(end, start);
  rowScopeNeed(start >= 0 && finish > start && text.indexOf(begin, start + 1) < 0 && text.indexOf(end, finish + 1) < 0, "INVERSE_MARKER");
  return text.slice(0, start) + text.slice(finish);
}
export function rowScopeValidate(s) {
  rowScopeBoundary(s);
  rowScopeNeed(s.bodies && typeof s.bodies === "object", "BODIES");
  const sourcePaths = [...ROW_SCOPE_MODIFIED, ...ROW_SCOPE_NEW];
  for (const row of [...s.sourceRows, ...s.metadataRows]) {
    const b = s.bodies[row.path]; rowScopeNeed(b && typeof b.source === "string" && typeof b.head === "string", "BODY_MISSING");
    rowScopeNeed(row.status === "A" ? b.base === null : typeof b.base === "string", "BASE_BODY");
    if (sourcePaths.includes(row.path)) rowScopeNeed(rowScopeLf(b.source) === rowScopeLf(b.head), "SOURCE_LAYER_CHANGED");
    else rowScopeNeed(rowScopeLf(b.source) === rowScopeLf(b.base), "METADATA_EARLY_CHANGE");
  }
  const src = (path) => rowScopeLf(s.bodies[path].source);
  const base = (path) => rowScopeLf(s.bodies[path].base);
  const pins = {
    "app/admin/data/billing.js": "fde08533a25c02eb875adf2dbe21d9676ae923149c2172a6c581fe526debf0ac",
    "app/admin/actions/billing.js": "45655328b301b63d63d5a8d44c60b3015c7cff89aa644944dd0b3f10d14877ae",
    "app/admin/views/billing.js": "36dec8b2e0a165cd338f763468cf08c62a974f67402be9c628223834f59d900f",
    "tests/fixtures/r3-substitute-policy-private-reviewed.fragment.js": "61d8607c62a06d6a8c7262c3b3c2e6786948a296deb3b8839770d65d06ec963b",
    "scripts/verify.sh": "aa65124fa1529730eb1251ad1b6229777e4d612fb960761d9f1d739f15ca291d",
    "scripts/check_r3_dev_deployment.py": "ac5490b507fc7e23554a35ac7fe6756161b40deb9cf1fd0e269ab5897724008d",
    ".github/workflows/tennisnote-public-ci.yml": ROW_SCOPE_WORKFLOW_PIN,
    "tests/r3-substitute-policy-row-scope.test.cjs": ROW_SCOPE_TEST_PIN,
  };
  for (const [path, pin] of Object.entries(pins)) {
    rowScopeNeed(/^[a-f0-9]{64}$/.test(pin) && rowScopeBodyHash(src(path)) === pin, "SOURCE_PIN");
  }
  const self = src(SELF), begin = "// ROW_SCOPE_PACKET_BEGIN: 이 경계는 소스 수집만 하며 배포 승인이 아닙니다.\n", end = "// ROW_SCOPE_PACKET_END\n\n";
  const start = self.indexOf(begin), finish = self.indexOf(end, start);
  rowScopeNeed(start >= 0 && finish > start && self.indexOf(begin, start + 1) < 0 && self.indexOf(end, finish + 1) < 0, "SELF_MARKERS");
  const block = self.slice(start, finish + end.length);
  const declarations = [...block.matchAll(/^export const ROW_SCOPE_BODY_SEAL = "([^"]*)";$/gm)];
  rowScopeNeed(declarations.length === 1 && declarations[0][1] === ROW_SCOPE_BODY_SEAL, "SEAL_DECLARATION");
  const normalized = block.replace(/^export const ROW_SCOPE_BODY_SEAL = "(?:PENDING|[a-f0-9]{64})";$/m, 'export const ROW_SCOPE_BODY_SEAL = "PENDING";');
  rowScopeNeed(/^[a-f0-9]{64}$/.test(ROW_SCOPE_BODY_SEAL) && rowScopeBodyHash(normalized) === ROW_SCOPE_BODY_SEAL, "SELF_SEAL");
  const entry = '    if (rowScopeRequested(process.argv.slice(2), process.env)) { rowScopeMain(process.argv.slice(2)); } else {\n';
  const close = '    } // ROW_SCOPE_B2B_ENTRY_END\n';
  let originalSelf = self.slice(0, start) + self.slice(finish + end.length);
  rowScopeNeed(originalSelf.split(entry).length === 2 && originalSelf.split(close).length === 2, "SELF_ENTRY");
  originalSelf = originalSelf.replace(entry, "").replace(close, "");
  rowScopeNeed(originalSelf === base(SELF), "SELF_INVERSE");
  const verifyBlock = '\n# 검수된 17개 제품 검사는 반복하지 않고 실제 경로 연결 차이만 확인합니다.\nif [[ "${1:-}" == "--r3-substitute-row-scope" ]]; then\n  [[ $# -eq 1 ]] || exit 2\n  node --test --test-name-pattern="^integration:" tests/r3-substitute-policy-row-scope.test.cjs\n  exit $?\nfi\n';
  rowScopeNeed(src("scripts/verify.sh").split(verifyBlock).length === 2
    && src("scripts/verify.sh").replace(verifyBlock, "") === base("scripts/verify.sh"), "VERIFY_INVERSE");
  const helper = src("scripts/check_r3_dev_deployment.py"), hBegin = "def row_scope_validate_ci_evidence(", hEnd = "def main() -> int:";
  const helperEntry = '        # ROW_SCOPE_DEV_569_ENTRY_BEGIN\n        if os.environ.get("GITHUB_REF") == "refs/heads/" + ROW_SCOPE_DEV_BRANCH:\n            row_scope_dispatch(args)\n            return 0\n        # ROW_SCOPE_DEV_569_ENTRY_END\n';
  const helperInverse = rowScopeRemoveBlock(helper, hBegin, hEnd);
  rowScopeNeed(helperInverse.split(helperEntry).length === 2
    && helperInverse.replace(helperEntry, "") === base("scripts/check_r3_dev_deployment.py"), "HELPER_INVERSE");
  const workflowPath = ".github/workflows/tennisnote-public-ci.yml";
  const targetLine = '          R3_TARGET: \${{ github.base_ref || github.ref_name }}\n';
  const claimLine = "          R3_ROW_SCOPE_CLAIMED: \${{ github.event_name == 'pull_request' && github.head_ref == 'codex/tennisnote-r3-substitute-row-scope-dev569-20261030' }}\n";
  const oldChoice = '          if [ "$R3_LEGACY_CLAIMED" = true ]; then\n';
  const newChoice = '          if [ "$R3_ROW_SCOPE_CLAIMED" = true ]; then\n            node scripts/check_r3_purchase_identity_admission.mjs --ci-route --row-scope\n          elif [ "$R3_LEGACY_CLAIMED" = true ]; then\n';
  let expectedWorkflow = base(workflowPath);
  rowScopeNeed(expectedWorkflow.split(targetLine).length === 2 && expectedWorkflow.split(oldChoice).length === 2, "WORKFLOW_ANCHOR");
  expectedWorkflow = expectedWorkflow.replace(targetLine, targetLine + claimLine).replace(oldChoice, newChoice);
  rowScopeNeed(src(workflowPath) === expectedWorkflow, "WORKFLOW_INVERSE");
  const testSource = src("tests/r3-substitute-policy-row-scope.test.cjs");
  const matches = [...testSource.matchAll(/^test\("([^"\n]+)"[\s\S]*?^\}\);/gm)];
  for (const [name, digest] of ROW_SCOPE_CALLBACK_PINS) {
    const found = matches.filter((match) => match[1] === name);
    rowScopeNeed(found.length === 1 && rowScopeBodyHash(found[0][0]) === digest, "CALLBACK_PIN");
  }
  rowScopeNeed(testSource.includes('path.join(root, counterpart.path)')
    && testSource.includes('digest(frozen), counterpart.sha256')
    && testSource.includes('Object.keys(reviewedSourcePins)'), "INDEPENDENT_LOADER");
  let release; try { release = JSON.parse(rowScopeLf(s.bodies["app/release.json"].head)); } catch { throw Error("ROW_SCOPE_RELEASE_JSON"); }
  rowScopeNeed(release.version === "1.0.569" && release.appSurfaceVersion === "1.0.569"
    && release.releaseId === "2026.10.30.02" && /^2026-10-30T/.test(release.deployedAt)
    && Number.isFinite(Date.parse(release.deployedAt)), "RELEASE");
  const normalizedRelease = { ...release, memberCache: "tennis-note-member-pwa-v602", coachCache: "tennis-note-coach-mode-v575" };
  for (const path of METADATA) rowScopeNeed(rowScopeLf(s.bodies[path].head) === expectedMetadata(path, base(path), normalizedRelease, "1.0.568"), "METADATA_CONTENT");
  return { status: "SOURCE_BODY_VALID_LOCAL_ONLY_NOT_ADMITTED", sourceFiles: sourcePaths.length, metadataFiles: METADATA.length, workflowRoutePending: false, deploymentAdmitted: false };
}
export function rowScopeRequested(args, env) {
  return args.includes("--row-scope") || env.GITHUB_HEAD_REF === ROW_SCOPE_BRANCH
    || env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.GITHUB_REF === "refs/heads/" + ROW_SCOPE_BRANCH;
}
export function rowScopeMain(args) {
  rowScopeNeed(rowScopeSame(args, ["--ci-route", "--row-scope"]) || rowScopeSame(args, ["--dev-source", "--row-scope"]), "ARGS");
  const env = process.env, isCi = args[0] === "--ci-route";
  rowScopeNeed(isCi ? env.GITHUB_EVENT_NAME === "pull_request" : env.GITHUB_EVENT_NAME === "workflow_dispatch", "EVENT");
  const event = JSON.parse(readFileSync(env.GITHUB_EVENT_PATH, "utf8"));
  const head = isCi ? event.pull_request?.head?.sha : env.GITHUB_SHA;
  const packet = rowScopePacket(ROOT, head);
  rowScopeNeed(isCi ? Boolean(packet.ci) : Boolean(packet.dev), "CONTEXT_KIND");
  const evidence = rowScopeValidate(packet);
  rowScopeNeed(evidence.status === "SOURCE_BODY_VALID_LOCAL_ONLY_NOT_ADMITTED", "SOURCE_RESULT");
  if (isCi) {
    const output = execFileSync(process.execPath, ["--test", "--test-reporter=tap", "--test-name-pattern=^integration: B2b route", ROW_SCOPE_NEW[0]],
      { cwd: ROOT, encoding: "utf8", env: { ...env, GIT_NO_LAZY_FETCH: "1" }, timeout: 30000, maxBuffer: 2000000 });
    rowScopeNeed(/^# pass 1$/m.test(output) && /^# fail 0$/m.test(output) && /^ok \d+ - integration: B2b route/m.test(output), "FOCUSED_RECEIPT");
  }
  const check = (...args) => execFileSync("git", args, { cwd: ROOT, encoding: "utf8", env: { ...env, GIT_NO_LAZY_FETCH: "1" }, timeout: 15000, maxBuffer: 8 * 1024 * 1024 }).trimEnd();
  rowScopeNeed(check("status", "--porcelain", "--untracked-files=all") === "" && check("diff", "--cached", "--name-only") === ""
    && check("rev-parse", "HEAD") === packet.checkout, "POST_STATE");
  const release = JSON.parse(rowScopeLf(packet.bodies["app/release.json"].head));
  const proof = { contract: "r3-substitute-row-scope-public/1", status: "SOURCE_PROVEN", base: ROW_SCOPE_BASE,
    branch: ROW_SCOPE_BRANCH, head: packet.head, checkout: packet.checkout, tree: packet.headTree, sourceFiles: evidence.sourceFiles,
    metadataFiles: evidence.metadataFiles, layers: 2, release: { ...release, memberCache: "tennis-note-member-pwa-v602", coachCache: "tennis-note-coach-mode-v575" },
    databaseActions: 0, deploymentAdmitted: false };
  if (isCi) appendFileSync(env.GITHUB_OUTPUT, "scoped=true\nrow_scope_only=true\n");
  console.log(JSON.stringify(proof));
  return proof;
}
// ROW_SCOPE_BODY_B2A_END
// ROW_SCOPE_PACKET_END

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
    if (s.profile === "development") for (const path of [...sourcePaths, ...METADATA]) summaryNeed(s.sourceModes[path] === "100644", "SOURCE_MODE");
  }
}
export function summaryValidate(s) {
  summaryBoundary(s);
  const p = SUMMARY_PROFILES[s.profile];
  for (const path of SUMMARY_UI) summaryNeed(s.bodies[path] === summaryExpectedUi(path, s.originals[path]), "UI_BYTES");
  summaryNeed(summaryOriginal(s.bodies[SELF]) === s.originals[SELF] && summarySeal(s.bodies[SELF]) === SUMMARY_SEAL && /^[a-f0-9]{64}$/.test(SUMMARY_SEAL), "SELECTOR_INVERSE_SEAL");
  const marker = "\n// SUMMARY_LAYOUT_TEST_BEGIN\n", testBody = s.bodies[TEST];
  summaryNeed(testBody.split(marker).length === 2 && testBody.slice(0, testBody.indexOf(marker)) === s.originals[TEST] && hash(testBody.slice(testBody.indexOf(marker))) === SUMMARY_TEST_SUFFIX_HASH, "TEST_INVERSE");
  if (s.profile === "development") {
    const helper = "scripts/check_r3_dev_deployment.py";
    summaryNeed(hash(s.bodies[helper]) === SUMMARY_DEV_HELPER_HASH && summaryHelperOriginal(s.bodies[helper]) === s.originals[helper], "DEV_HELPER_INVERSE_PIN");
  }
  if (s.event !== "local") {
    const release = JSON.parse(s.bodies["app/release.json"]), normalized = { ...release, memberCache: "tennis-note-member-pwa-v" + p.member, coachCache: "tennis-note-coach-mode-v" + p.coach };
    summaryNeed(release.version === p.version && release.appSurfaceVersion === p.version && /^2026\.10\.30\.[0-9]{2}$/.test(release.releaseId) && /^2026-10-30T/.test(release.deployedAt) && Number.isFinite(Date.parse(release.deployedAt)), "RELEASE");
    for (const path of METADATA) summaryNeed(s.bodies[path] === expectedMetadata(path, s.originals[path], normalized, p.previous), "METADATA_BYTES");
    if (!(s.profile === "production" && s.event === "push")) {
      for (const path of summaryPaths(s.profile)) summaryNeed(s.sourceBodies[path] === s.bodies[path], "SOURCE_UNCHANGED");
      for (const path of METADATA) summaryNeed(s.sourceBodies[path] === s.originals[path], "EARLY_METADATA");
    }
  }
  return { contract: "r3-summary-public-source/1", status: s.event === "local" ? "LOCAL_SOURCE_ONLY" : "SOURCE_PROVEN", head: s.event === "local" ? null : s.head, checkout: s.event === "local" ? null : s.checkout, tree: s.event === "local" ? null : s.tree, base: p.base, profile: s.profile, files: s.rows.length, layers: s.event === "local" ? null : 2, admissionRoute: s.profile === "development" ? "summary-layout-dev568-manual" : "summary-layout-prod561", privateSource: { commit: "a8da7b7c25f5f47c27cc5d12dcb3fc46b41d26f2", tree: "c26e11ee4444eade7e756cfd570bdafdc4827fff" }, release: s.event === "local" ? null : { ...JSON.parse(s.bodies["app/release.json"]), memberCache: "tennis-note-member-pwa-v" + p.member, coachCache: "tennis-note-coach-mode-v" + p.coach }, databaseActions: 0, browserRuns: 0, deploymentAdmitted: false };
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
    number: e.number, prNumber: e.pull_request?.number, target: e.pull_request?.base?.ref, baseRepo: e.pull_request?.base?.repo?.full_name, headRepo: e.pull_request?.head?.repo?.full_name, clean: git("status", "--porcelain", "--untracked-files=all") === "", indexEmpty: git("diff", "--cached", "--name-only") === "", modes: {}, sourceModes: {}, bodies: {}, originals: {}, sourceBodies: {} };
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
  if (!local && profile === "development") for (const name of [...summaryPaths(profile), ...METADATA]) s.sourceModes[name] = git("ls-tree", "--format=%(objectmode)", s.parents[0], "--", name);
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
  const newPattern = s.profile === "development" ? "^SUMMARY-DEV:" : "^SUMMARY-LAYOUT:";
  let testOutput;
  try {
    testOutput = execFileSync(process.execPath, ["--test", "--test-reporter=tap", "--test-name-pattern=" + newPattern, TEST], { cwd: ROOT, encoding: "utf8", env: { ...process.env, R3_PRODUCTION_SELECTED: "1" }, stdio: ["ignore", "pipe", "pipe"], timeout: 30000, maxBuffer: 2000000 });
  } catch (error) {
    const failed = String(error.stdout || "").match(/^not ok \d+ - SUMMARY-(?:DEV|LAYOUT): [^\r\n]{1,140}$/gm) || [];
    console.error(JSON.stringify({ code: error.code === "ETIMEDOUT" ? "SUMMARY_NEW_TEST_TIMEOUT" : "SUMMARY_NEW_TEST_FAILED", failedNamedCases: failed }));
    throw Error("SUMMARY_NEW_TEST_HOLD");
  }
  const newBoundaryCases = Number(testOutput.match(/^# pass (\d+)$/m)?.[1]);
  summaryNeed(newBoundaryCases === (s.profile === "development" ? 4 : 5) && /^# fail 0$/m.test(testOutput), "NEW_TEST_RECEIPT");
  summaryNeed(git("status", "--porcelain", "--untracked-files=all") === initial, "POST_STATE");
  if (args[0] === "--ci-route") appendFileSync(process.env.GITHUB_OUTPUT, "scoped=true\nsummary_source_only=true\n");
  console.log(JSON.stringify({ ...proof, newBoundarySuiteExecuted: true, newBoundaryCases, previousBrowser112Reused: true }));
}
// SUMMARY_LAYOUT_SUCCESSOR_END

// CURRENT_TERM_PUBLIC_BEGIN
export const CURRENT_TERM_PUBLIC_BASE = "436d11ac11fb31ff0d02a8f9de9233a71f0fe00f";
export const CURRENT_TERM_PUBLIC_TREE = "d01f2d0903ed43ba8b1f9ac87820314f9515c4e2";
export const CURRENT_TERM_PUBLIC_PARENT = "codex/tennisnote-r3-substitute-row-scope-dev569-20261030";
export const CURRENT_TERM_PUBLIC_HEAD = "codex/tennisnote-r3-current-term-dev570-20261031";
export const CURRENT_TERM_PUBLIC_TEST = "tests/r3-current-term-focused.test.js";
export const CURRENT_TERM_PUBLIC_PRIVATE_LF = "69dd4cb4c6db3038b32455f4a1375cacda448a33960077cd43f96ef0667fe2ca";
export const CURRENT_TERM_PUBLIC_PRIVATE_COMMIT = "5f6684792b83ca2a3f381517aab22e6be1e2c08a";
export const CURRENT_TERM_PUBLIC_PRIVATE_TREE = "e7f4b8c5bb57fb1d860c46f34f3354c2c3b02d2c";
export const CURRENT_TERM_PUBLIC_PINS = Object.freeze({
  "app/admin/actions/coach.js": "97742728727914f9aa774c334d03507d63856cdea0ba6448f769adb23ba0c201",
  "app/admin/domain/coaches.js": "67e5be0a0402027c330f0cb82f123c9d92aba7eabbc2bac99f35132d7929d354",
  "app/admin/domain/members.js": "72779b96699f3f8281a7100c5986422d47b41877dee45760f6409b23a0535117",
  "tests/r3-current-term-focused.test.js": "da92f36eb4f722149104c3a8f5570c5e99845fc0ed285dfe77441e0940c7b2e0",
  "app/admin/index.html": "2cda791fa632a02f33215a0b07fae7b6e861fc51efd170a67f3f92926a72fb20",
  "app/release.json": "5761ba84a181ede9781dc4832542fbb272ef2670da5e2c4433c026ae4b28761e",
  "app/shared/tennisnote-release.js": "751eb751db87caa772a59afa205b3565d6c5f346a0f0f3115f821383b91f6769",
  "app/tennis-note-coach-app/app.js": "44e15e09fd1c4dd06d4b8dc3fff7ce151140ec16bc6b14018d50697c260afe96",
  "app/tennis-note-coach-app/domain/coaches.js": "1fa735b3c4603180d70bb4a616a081ea6ef144a9dcbb528f1d4cc6a686bb3666",
  "app/tennis-note-coach-app/forms/common.js": "34446515f908686b3873f2c91820b85b689f71ee35ad8c773c3399d4a24585ba",
  "app/tennis-note-coach-app/index.html": "4eba480068e639937969032b72c827f0a2bcea95d1d15d6e2e4033080f5963b4",
  "app/tennis-note-coach-app/service-worker.js": "9abb2273f4ca8006a7825bf6efcdca401d257688d7cbfab4509f3a7c567c9cc7",
  "app/tennis-note-member-app/app.js": "eb6d07275743af0e9b1edb66ef5c67d68b7188b9ceb293bcf70ae5a2c2469ad7",
  "app/tennis-note-member-app/forms/common.js": "9ae595ab4d3e01b23bee0b5085afddc730425ba451a27174eb636c44ac040f27",
  "app/tennis-note-member-app/index.html": "13a79bc90c8eae6b1adcba93db3b653ddb4c67fdf9216c6dd05feeb00f9d4165",
  "app/tennis-note-member-app/service-worker.js": "acbadfce5a67c23e77a6b3f7940c9bd63ef32d5475dc73bbcd2c00120737ec60",
  "app/tennis-note-member-app/ui/screens.js": "e98e61780d6ac19c68424dfe67a78f752b625b8b86bd232a72cf93a5b5d8ce6b",
  "scripts/check_r3_dev_deployment.py": "82c5844e711d6d05119ceab031cd2545a019270763c68359af1213064254597c",
  ".github/workflows/tennisnote-public-ci.yml": "ef74017550fb4c8f18142424792d81e3f953740bf9880366732b32a65d9ebccd"
});
export const CURRENT_TERM_PUBLIC_SEAL = "d0eedf3d166cde989dc935ff5955ec4d4cf45b2a495adf71f194a2c4493293a3";
export const CURRENT_TERM_PUBLIC_BLOBS = Object.freeze([
  ["583d8d0ca9f1143b01254b7ba368517b2dadfa1b",90460],
  ["69b0b0fe7bbda4ebadd052d4ed91a5b42afee292",8245]
]);
export const currentTermPublicClaimed = (args,env) => args.includes("--current-term") ||
  args.includes("--current-term-blob-transport") ||
  env.GITHUB_EVENT_NAME === "pull_request" && (env.GITHUB_BASE_REF === CURRENT_TERM_PUBLIC_PARENT || env.GITHUB_HEAD_REF === CURRENT_TERM_PUBLIC_HEAD) ||
  env.GITHUB_EVENT_NAME === "workflow_dispatch" && env.GITHUB_REF === "refs/heads/"+CURRENT_TERM_PUBLIC_HEAD;
const ctNeed = (v,code)=>need(v,"CURRENT_TERM_"+code);
const ctSha = s=>typeof s==="string" && /^[a-f0-9]{40}$/.test(s) && !/^0+$/.test(s);
export function currentTermPublicBlob(payload,oid,size) {
  ctNeed(payload && payload.sha===oid && payload.encoding==="base64" && payload.size===size &&
    typeof payload.content==="string" && payload.content.length<=200000,"BLOB");
  const encoded=payload.content.replace(/[\r\n]/g,"");
  ctNeed(/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(encoded),"BLOB");
  const bytes=Buffer.from(encoded,"base64");
  ctNeed(bytes.length===size && bytes.toString("base64")===encoded &&
    createHash("sha1").update(Buffer.from("blob "+size+"\0")).update(bytes).digest("hex")===oid,"BLOB");
  return bytes;
}
export async function currentTermPublicTransport(get,write) {
  ctNeed(typeof get==="function" && typeof write==="function","BLOB");
  const checked=[];
  for(const [oid,size] of CURRENT_TERM_PUBLIC_BLOBS) checked.push([oid,currentTermPublicBlob(await get(oid),oid,size)]);
  for(const [oid,bytes] of checked) ctNeed(await write(bytes)===oid,"BLOB");
  return {status:"EXACT_TWO_BASE_BLOBS_PREPARED",count:2};
}
async function currentTermPublicHttp(oid) {
  const response=await fetch("https://api.github.com/repos/leisurewang0827/tennis-note-public/git/blobs/"+oid,
    {headers:{Accept:"application/vnd.github+json","X-GitHub-Api-Version":"2022-11-28"},redirect:"error",signal:AbortSignal.timeout(15000)});
  ctNeed(response.status===200 && response.body,"BLOB_HTTP");
  const reader=response.body.getReader(),chunks=[];let length=0;
  for(;;){const item=await reader.read();if(item.done)break;length+=item.value.length;ctNeed(length<=200000,"BLOB_HTTP");chunks.push(Buffer.from(item.value));}
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
async function currentTermPublicPrepare(args,env) {
  ctNeed(same(args,["--current-term-blob-transport"]) && env.GITHUB_EVENT_NAME==="pull_request" &&
    env.GITHUB_REPOSITORY===REPOSITORY && env.GITHUB_BASE_REF===CURRENT_TERM_PUBLIC_PARENT &&
    env.GITHUB_HEAD_REF===CURRENT_TERM_PUBLIC_HEAD && env.GITHUB_WORKFLOW==="Tennis Note Public PWA CI" && env.GITHUB_RUN_ATTEMPT==="1","BLOB_CONTEXT");
  const event=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,"utf8")),pr=event.pull_request;
  ctNeed(event.repository?.full_name===REPOSITORY && pr?.base?.repo?.full_name===REPOSITORY &&
    pr?.head?.repo?.full_name===REPOSITORY && pr?.base?.sha===CURRENT_TERM_PUBLIC_BASE &&
    pr?.base?.ref===CURRENT_TERM_PUBLIC_PARENT && pr?.head?.ref===CURRENT_TERM_PUBLIC_HEAD &&
    ctSha(pr?.head?.sha) && Number.isSafeInteger(event.number) && event.number>0 && event.number===pr?.number &&
    env.GITHUB_REF==="refs/pull/"+event.number+"/merge" && env.GITHUB_WORKFLOW_SHA===env.GITHUB_SHA &&
    env.GITHUB_WORKFLOW_REF===REPOSITORY+"/.github/workflows/tennisnote-public-ci.yml@"+env.GITHUB_REF,"BLOB_CONTEXT");
  const git=(...args)=>execFileSync("git",args,{cwd:ROOT,encoding:"utf8",
    env:{...env,GIT_NO_LAZY_FETCH:"1"},timeout:15000,maxBuffer:1000000,stdio:["ignore","pipe","pipe"]}).trim();
  const parents=git("show","-s","--format=%P",pr.head.sha).split(" "),source=parents[0];
  ctNeed(git("rev-parse","HEAD")===env.GITHUB_SHA && ctSha(env.GITHUB_SHA) && parents.length===1 && ctSha(source) &&
    same(git("show","-s","--format=%P",source).split(" "),[CURRENT_TERM_PUBLIC_BASE]) &&
    same(git("show","-s","--format=%P",env.GITHUB_SHA).split(" "),[CURRENT_TERM_PUBLIC_BASE,pr.head.sha]) &&
    git("rev-parse",pr.head.sha+"^{tree}")===git("rev-parse",env.GITHUB_SHA+"^{tree}") &&
    git("status","--porcelain","--untracked-files=all")==="" && git("diff","--cached","--name-only")==="","BLOB_CONTEXT");
  const result=await currentTermPublicTransport(currentTermPublicHttp,
    bytes=>execFileSync("git",["hash-object","-w","--stdin"],{cwd:ROOT,input:bytes,encoding:"utf8",
      env:{...env,GIT_NO_LAZY_FETCH:"1"},timeout:15000,maxBuffer:1000,stdio:["pipe","pipe","pipe"]}).trim());
  console.log(JSON.stringify(result));
}
export function currentTermPublicBoundary(s) {
  const ci=s?.event==="pull_request", dev=s?.event==="workflow_dispatch";
  ctNeed(s && (ci||dev) && s.repo===REPOSITORY && s.eventRepo===REPOSITORY
    && s.base===CURRENT_TERM_PUBLIC_BASE && s.baseTree===CURRENT_TERM_PUBLIC_TREE && s.branch===CURRENT_TERM_PUBLIC_HEAD,"IDENTITY");
  ctNeed(s.attempt==="1" && s.clean && s.indexClean && !s.symlinks && s.checkoutBranch==="","CLEAN");
  ctNeed(ctSha(s.head) && ctSha(s.source) && ctSha(s.checkout) && ctSha(s.tree) && s.tree===s.checkoutTree &&
    same(s.parents,[s.source]) && same(s.sourceParents,[CURRENT_TERM_PUBLIC_BASE]),"GRAPH");
  if(ci) ctNeed(s.baseRepo===REPOSITORY && s.headRepo===REPOSITORY && s.target===CURRENT_TERM_PUBLIC_PARENT &&
    same(s.mergeParents,[CURRENT_TERM_PUBLIC_BASE,s.head]) && Number.isSafeInteger(s.number) && s.number>0 &&
    s.ref==="refs/pull/"+s.number+"/merge" && s.workflow==="Tennis Note Public PWA CI" &&
    s.workflowSha===s.checkout && s.workflowRef===REPOSITORY+"/.github/workflows/tennisnote-public-ci.yml@"+s.ref && s.githubSha===s.checkout,"WORKFLOW");
  else ctNeed(s.head===s.checkout && s.ref==="refs/heads/"+CURRENT_TERM_PUBLIC_HEAD && s.workflow==="Deploy Tennis Note development sites" &&
    s.workflowSha===s.head && s.workflowRef===REPOSITORY+"/.github/workflows/deploy-cloudflare-pages-dev.yml@"+s.ref && s.githubSha===s.head,"WORKFLOW");
  const allowed=[SELF,...Object.keys(CURRENT_TERM_PUBLIC_PINS)], found=new Set();
  ctNeed(Array.isArray(s.rows) && s.rows.length===allowed.length,"PATHS");
  for(const [status,path] of s.rows) {
    ctNeed(allowed.includes(path) && !found.has(path) && status===(path===CURRENT_TERM_PUBLIC_TEST?"A":"M") && s.modes[path]==="100644","PATHS"); found.add(path);
  }
  const sourcePaths=allowed.filter(path=>!METADATA.includes(path));
  ctNeed(Array.isArray(s.sourceRows) && s.sourceRows.length===sourcePaths.length
    && Array.isArray(s.metadataRows) && s.metadataRows.length===METADATA.length,"LAYERS");
  const checkRows=(rows,paths)=>ctNeed(rows.every(([status,path])=>paths.includes(path) &&
    status===(path===CURRENT_TERM_PUBLIC_TEST?"A":"M")) && new Set(rows.map(x=>x[1])).size===paths.length,"LAYERS");
  checkRows(s.sourceRows,sourcePaths); checkRows(s.metadataRows,METADATA);
  return {status:"BOUNDARY_ONLY_NOT_ADMITTED"};
}
export function currentTermPublicValidate(s) {
  currentTermPublicBoundary(s);
  for(const [path,pin] of Object.entries(CURRENT_TERM_PUBLIC_PINS))
    ctNeed(typeof s.bodies[path]==="string" && hash(lf(s.bodies[path]))===pin,"PIN");
  const body=lf(s.bodies[SELF]), begin="// CURRENT_TERM_PUBLIC_BEGIN\n",end="// CURRENT_TERM_PUBLIC_END\n\n",a=body.indexOf(begin),b=body.indexOf(end,a);
  ctNeed(a>=0 && b>a && body.indexOf(begin,a+1)<0 && body.indexOf(end,b+1)<0,"SEAL");
  const block=body.slice(a,b+end.length), norm=block.replace(/^export const CURRENT_TERM_PUBLIC_SEAL = "(?:PENDING|[a-f0-9]{64})";$/m,'export const CURRENT_TERM_PUBLIC_SEAL = "PENDING";');
  ctNeed(/^[a-f0-9]{64}$/.test(CURRENT_TERM_PUBLIC_SEAL) && hash(norm)===CURRENT_TERM_PUBLIC_SEAL,"SEAL");
  const open='    if (currentTermPublicClaimed(process.argv.slice(2), process.env)) { if (process.argv[2]==="--current-term-blob-transport") await currentTermPublicPrepare(process.argv.slice(2),process.env); else currentTermPublicMain(process.argv.slice(2)); } else {\n', close='    } // CURRENT_TERM_PUBLIC_ENTRY_END\n';
  const inverse=body.slice(0,a)+body.slice(b+end.length);
  ctNeed(inverse.split(open).length===2 && inverse.split(close).length===2 && inverse.replace(open,"").replace(close,"")===lf(s.oldSelf),"INVERSE");
  let wf=lf(s.bodies[".github/workflows/tennisnote-public-ci.yml"]);
  const start="    steps:\n      - uses: actions/checkout@v7\n", first=wf.indexOf(start), receipt=wf.indexOf("      - name: Verify current-term admission receipt\n",first);
  const next=wf.indexOf("      - uses: actions/checkout@v7\n",receipt);
  ctNeed(first>=0 && receipt>first && next>receipt,"WORKFLOW_INVERSE");
  wf=wf.slice(0,first)+"    steps:\n"+wf.slice(next);
  const wrap=/^        if: steps\.current_term\.outputs\.scoped != 'true' && \((.*)\)$/gm;
  ctNeed([...wf.matchAll(wrap)].length===10,"WORKFLOW_INVERSE");
  wf=wf.replace(wrap,(_,c)=>"        if: "+c)
    .replace(/^        if: (\!\(startsWith\(github\.head_ref[^\n]+)$/m,(_,c)=>"        if: ${{ "+c+" }}")
    .replace("      - uses: actions/setup-python@v7\n        if: steps.current_term.outputs.scoped != 'true'\n", "      - uses: actions/setup-python@v7\n")
    .replace("      - uses: actions/setup-node@v7\n        if: steps.current_term.outputs.scoped != 'true'\n", "      - uses: actions/setup-node@v7\n")
    .replace("        id: display\n        if: steps.current_term.outputs.scoped != 'true'\n", "        id: display\n");
  ctNeed(typeof s.oldWorkflow==="string" && wf===lf(s.oldWorkflow),"WORKFLOW_INVERSE");
  const release=JSON.parse(s.bodies["app/release.json"]);
  ctNeed(release.version==="1.0.570" && release.appSurfaceVersion==="1.0.570" && release.releaseId==="2026.10.31.01","RELEASE");
  return {status:"SOURCE_ONLY_NOT_ADMITTED",privateSourceCommit:CURRENT_TERM_PUBLIC_PRIVATE_COMMIT,privateSourceTree:CURRENT_TERM_PUBLIC_PRIVATE_TREE,privateSourceLfSha256:CURRENT_TERM_PUBLIC_PRIVATE_LF};
}
export function currentTermPublicReceipt(out,count) {
  ctNeed(typeof out==="string" && out.trim()==="focused current-term "+count+"/"+count+" PASS","RECEIPT");
}
export function currentTermPublicFocused(run) {
  ctNeed(typeof run==="function","CHILD");
  for(const [flags,count] of [[[],13],[["--consumer-only"],20]]) currentTermPublicReceipt(run(flags),count);
}
function currentTermPublicMain(args) {
  const ci=same(args,["--ci-route","--current-term"]),dev=same(args,["--dev-source","--current-term"]);
  ctNeed(ci||dev,"ARGS");
  const env=process.env,event=JSON.parse(readFileSync(env.GITHUB_EVENT_PATH,"utf8")),pr=event.pull_request;
  const raw=(...args)=>execFileSync("git",args,{cwd:ROOT,encoding:"utf8",env:{...env,GIT_NO_LAZY_FETCH:"1"},timeout:15000,maxBuffer:8*1024*1024});
  const g=(...args)=>raw(...args).trimEnd(),head=ci?pr?.head?.sha:env.GITHUB_SHA,checkout=g("rev-parse","HEAD"),
    parents=g("show","-s","--format=%P",head).split(" ").filter(Boolean),source=parents[0];
  const s={event:env.GITHUB_EVENT_NAME,repo:env.GITHUB_REPOSITORY,eventRepo:event.repository?.full_name,baseRepo:pr?.base?.repo?.full_name,
    headRepo:pr?.head?.repo?.full_name,base:ci?pr?.base?.sha:CURRENT_TERM_PUBLIC_BASE,baseTree:g("rev-parse",CURRENT_TERM_PUBLIC_BASE+"^{tree}"),target:pr?.base?.ref,branch:ci?pr?.head?.ref:CURRENT_TERM_PUBLIC_HEAD,
    head,source,checkout,tree:g("rev-parse",head+"^{tree}"),checkoutTree:g("rev-parse",checkout+"^{tree}"),
    parents,sourceParents:g("show","-s","--format=%P",source).split(" ").filter(Boolean),mergeParents:g("show","-s","--format=%P",checkout).split(" ").filter(Boolean),
    clean:g("status","--porcelain","--untracked-files=all")==="",indexClean:g("diff","--cached","--name-only")==="",symlinks:false,checkoutBranch:g("branch","--show-current"),
    attempt:env.GITHUB_RUN_ATTEMPT,number:event.number===pr?.number?event.number:null,ref:env.GITHUB_REF,workflow:env.GITHUB_WORKFLOW,workflowSha:env.GITHUB_WORKFLOW_SHA,
    workflowRef:env.GITHUB_WORKFLOW_REF,githubSha:env.GITHUB_SHA,rows:g("diff","--no-renames","--name-status",CURRENT_TERM_PUBLIC_BASE,head).split("\n").filter(Boolean).map(x=>x.split("\t")),
    sourceRows:g("diff","--no-renames","--name-status",CURRENT_TERM_PUBLIC_BASE,source).split("\n").filter(Boolean).map(x=>x.split("\t")),
    metadataRows:g("diff","--no-renames","--name-status",source,head).split("\n").filter(Boolean).map(x=>x.split("\t")),modes:{},bodies:{}};
  if(ci) ctNeed(env.GITHUB_HEAD_REF===CURRENT_TERM_PUBLIC_HEAD && env.GITHUB_BASE_REF===CURRENT_TERM_PUBLIC_PARENT,"IDENTITY");
  for(const path of [SELF,...Object.keys(CURRENT_TERM_PUBLIC_PINS)]) {
    s.modes[path]=g("ls-tree","--format=%(objectmode)",head,"--",path);
    let item=ROOT; ctNeed(!lstatSync(item).isSymbolicLink(),"SYMLINK");
    for(const part of path.split("/")) {item=resolve(item,part);ctNeed(!lstatSync(item).isSymbolicLink(),"SYMLINK");}
    ctNeed(lstatSync(item).isFile(),"FILE");
    s.bodies[path]=lf(readFileSync(item,"utf8")); ctNeed(s.bodies[path]===lf(raw("show",head+":"+path)),"BODY");
  }
  s.oldSelf=raw("show",CURRENT_TERM_PUBLIC_BASE+":"+SELF);
  s.oldWorkflow=raw("show",CURRENT_TERM_PUBLIC_BASE+":.github/workflows/tennisnote-public-ci.yml");
  currentTermPublicValidate(s);
  if(ci) currentTermPublicFocused(flags=>execFileSync(process.execPath,[CURRENT_TERM_PUBLIC_TEST,...flags],{cwd:ROOT,encoding:"utf8",env:{...env,GIT_NO_LAZY_FETCH:"1"},timeout:30000,maxBuffer:1000000,stdio:["ignore","pipe","pipe"]}));
  ctNeed(g("status","--porcelain","--untracked-files=all")==="" && g("rev-parse","HEAD")===checkout,"POST");
  if(ci) appendFileSync(env.GITHUB_OUTPUT,"scoped=true\ncurrent_term_pass=true\n");
  const release=JSON.parse(s.bodies["app/release.json"]);
  console.log(JSON.stringify({contract:"r3-current-term-public/1",status:"SOURCE_PROVEN",base:CURRENT_TERM_PUBLIC_BASE,branch:CURRENT_TERM_PUBLIC_HEAD,
    head:s.head,checkout:s.checkout,tree:s.tree,source:s.source,sourceFiles:s.sourceRows.length,metadataFiles:s.metadataRows.length,layers:2,
    release:{...release,memberCache:"tennis-note-member-pwa-v603",coachCache:"tennis-note-coach-mode-v576"},
    privateSourceCommit:CURRENT_TERM_PUBLIC_PRIVATE_COMMIT,privateSourceTree:CURRENT_TERM_PUBLIC_PRIVATE_TREE,
    privateSourceLfSha256:CURRENT_TERM_PUBLIC_PRIVATE_LF,databaseActions:0,deploymentAdmitted:false,...(ci?{counts:[13,20]}:{})}));
}
// CURRENT_TERM_PUBLIC_END

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (currentTermPublicClaimed(process.argv.slice(2), process.env)) { if (process.argv[2]==="--current-term-blob-transport") await currentTermPublicPrepare(process.argv.slice(2),process.env); else currentTermPublicMain(process.argv.slice(2)); } else {
    if (rowScopeRequested(process.argv.slice(2), process.env)) { rowScopeMain(process.argv.slice(2)); } else {
    if (summaryRequested(process.argv.slice(2), process.env)) { summaryMain(process.argv.slice(2)); } else {
    if(process.argv[3]==='--legacy-monthly' || (process.argv[2]==='--ci-route' && process.env.GITHUB_EVENT_PATH && legacyMonthlyClaimed(process.env,JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,'utf8'))))){legacyMonthlyMain(process.argv[2]);}
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
    } // ROW_SCOPE_B2B_ENTRY_END
    } // CURRENT_TERM_PUBLIC_ENTRY_END
  } catch { console.error("R3_PURCHASE_IDENTITY_HOLD"); process.exitCode = 2; }
}
