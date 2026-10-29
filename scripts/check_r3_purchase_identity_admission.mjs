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
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if(process.argv[3]==='--production'){productionMain(process.argv[2]);}
    else {
    const mode=process.argv[2],term=process.argv[3]==="--term-history";
    const checkout=process.argv[3]==="--checkout-mode";
    need(["--local","--ci-route","--dev-source"].includes(mode)&&process.argv.length===(term||checkout?4:3),"MODE");
    const proof=mode==="--local"?(checkout?localCheckoutOverlay():term?localTermOverlay():localOverlay()):verifyCheckout(context(process.env,JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH,"utf8")),git("rev-parse","HEAD")),undefined,term,checkout);
    if(mode==="--dev-source")need(proof.admissionRoute===(checkout?"dev566-manual":term?"dev565-manual":"dev564-manual"),"DEV_ONLY");
    if(mode==="--ci-route"){need(proof.event==="pull_request","CI_PR_ONLY");appendFileSync(process.env.GITHUB_OUTPUT,checkout?"scoped=true\ncheckout_mode_only=true\n":term?"scoped=true\nterm_history_only=true\n":"scoped=true\npurchase_identity_only=true\n");}
    console.log(JSON.stringify(proof));
    }
  } catch { console.error("R3_PURCHASE_IDENTITY_HOLD"); process.exitCode = 2; }
}
