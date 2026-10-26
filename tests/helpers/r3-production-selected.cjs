"use strict";
// 새 선별층의 기계적 소스만 먼저 검증한다. 기존 BASIC/553 기대값은 변경하지 않는다.
const fs = require("node:fs"), path = require("node:path");
const {execFileSync} = require("node:child_process");
const ROOT = path.resolve(__dirname, "../..");
const SOURCE_BASE = "8aada4bc43e275c2474c71a535c7e94eca4f26b5";
const DOC_ANCHOR = "| 버전 올리기 · 배포 | [docs/releasing.md](docs/releasing.md) |";
const DOC_POINTER = "| R3 운영 선별 후보·메타데이터 층 | [로컬 조립 계약](docs/tennisnote-r3-production-selected-local.md) |";
const gitShow = (revision, file) => execFileSync("git", ["show", `${revision}:${file}`], {cwd:ROOT,encoding:"utf8",maxBuffer:8*1024*1024,stdio:["ignore","pipe","pipe"]}).replace(/\r\n/g,"\n");
const RELEASE_PATHS = [
  "app/release.json", "app/shared/tennisnote-release.js", "app/admin/index.html",
  "app/tennis-note-member-app/index.html", "app/tennis-note-member-app/service-worker.js",
  "app/tennis-note-member-app/app.js", "app/tennis-note-member-app/forms/common.js",
  "app/tennis-note-member-app/ui/screens.js", "app/tennis-note-coach-app/index.html",
  "app/tennis-note-coach-app/service-worker.js", "app/tennis-note-coach-app/app.js",
  "app/tennis-note-coach-app/domain/coaches.js", "app/tennis-note-coach-app/forms/common.js",
];
const CHECKPOINT_PATHS = [...new Set([
  "app/admin/actions/billing.js", "app/admin/data/billing.js", "app/admin/events/billing.js",
  "app/admin/index.html", "app/admin/views/billing.js",
  "app/tennis-note-coach-app/data/sync.js", "app/tennis-note-coach-app/domain/settlement.js",
  "app/tennis-note-coach-app/events/account.js", "app/tennis-note-coach-app/index.html",
  "app/tennis-note-coach-app/styles.css", "app/tennis-note-coach-app/views/settlement.js",
  "scripts/check_tennisnote_dev_prod_alignment.py", "scripts/check_r3_production_selected_browser.cjs",
  "tests/fixtures/r3-production-selected-source.json", "tests/helpers/r3-production-selected.cjs",
  "tests/helpers/r3-basic-refresh-production.cjs", "tests/r3-basic-refresh-production.test.js",
  "tests/r3-production-selected.test.js", "docs/tennisnote-r3-production-selected-local.md",
  "tests/fixtures/r3-production-selected-release.json", "AGENTS.md", "tests/helpers/r3-production-promotion.cjs", ...RELEASE_PATHS,
])];
let cached, cachedRelease;
function loadPlan(name) {
    const python = process.env.TENNISNOTE_PYTHON || (process.platform === "win32" ? "python" : "python3");
    return JSON.parse(execFileSync(python, ["-B", "-X", "utf8", "-c", String.raw`
import importlib.util,json,sys
spec=importlib.util.spec_from_file_location("alignment","scripts/check_tennisnote_dev_prod_alignment.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
print(json.dumps(getattr(m,sys.argv[1])(),ensure_ascii=True))
`, name], {cwd:ROOT,encoding:"utf8",maxBuffer:16*1024*1024,stdio:["ignore","pipe","pipe"]}));
}
function plan() { return cached || (cached = loadPlan("selected_r3_plan")); }
function releasePlan() { return cachedRelease || (cachedRelease = loadPlan("selected_release_plan")); }
function restoreRelease(file, text) {
  const current = text.replace(/\r\n/g,"\n");
  if (!RELEASE_PATHS.includes(file)) return current;
  const row = releasePlan()[file];
  if (current === row.before || (plan()[file] && current === plan()[file].before)) return current;
  if (current !== row.after) throw Error(`selected R3 ${plan()[file] ? "" : "release "}exact candidate mismatch: ${file}`);
  return row.before;
}
function restore(file, text) {
  const row = plan()[file], current = restoreRelease(file, text);
  if (!row || current === row.before) return current;
  if (current !== row.after) throw Error(`selected R3 exact candidate mismatch: ${file}`);
  return row.before;
}
function verifyDocRegistration(text = fs.readFileSync(path.join(ROOT,"AGENTS.md"),"utf8")) {
  const before = gitShow(SOURCE_BASE,"AGENTS.md");
  if (before.split(DOC_ANCHOR).length !== 2 || before.includes(DOC_POINTER)) throw Error("selected R3 document base mismatch");
  const expected = before.replace(DOC_ANCHOR, `${DOC_ANCHOR}\n${DOC_POINTER}`);
  if (typeof text !== "string" || text.replace(/\r\n/g,"\n") !== expected) throw Error("selected R3 document registration exact pointer mismatch");
  return before;
}
function verifyCurrent() {
  verifyDocRegistration();
  for (const [file,row] of Object.entries(releasePlan())) {
    if (fs.readFileSync(path.join(ROOT,file),"utf8").replace(/\r\n/g,"\n") !== row.after) throw Error(`selected R3 release exact candidate mismatch: ${file}`);
  }
  for (const [file,row] of Object.entries(plan())) {
    const current = restoreRelease(file,fs.readFileSync(path.join(ROOT,file),"utf8"));
    if (current !== row.after) throw Error(`selected R3 exact candidate mismatch: ${file}`);
  }
}
function restoreHistoricalAppPaths(paths, restoreBasic, io = {}) {
  const rawContract = gitShow(SOURCE_BASE,"tests/fixtures/r3-production-promotion.json");
  if (fs.readFileSync(path.join(ROOT,"tests/fixtures/r3-production-promotion.json"),"utf8").replace(/\r\n/g,"\n") !== rawContract) throw Error("selected R3 historical golden drift");
  const historical = JSON.parse(rawContract);
  if (historical.base !== "686cc97d9676da2d16ca3cdfbd862dc9cd19434e" || historical.files.length !== 35) throw Error("selected R3 historical source mismatch");
  const expected = [...new Set([...historical.files.map(x=>x.path), ...Object.keys(plan()), ...RELEASE_PATHS])].sort();
  if (paths.length !== new Set(paths).size || JSON.stringify([...paths].sort()) !== JSON.stringify(expected)) throw Error("selected R3 historical observed path set mismatch");
  // 별도 실제 관측에서도 선별22 전체가 있어야 한다. 알려지지 않은 변경을 단순 제외하지 않는다.
  const observed = [
    ...execFileSync("git",["diff","--name-only",SOURCE_BASE,"--","app"],{cwd:ROOT,encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean),
    ...execFileSync("git",["ls-files","--others","--exclude-standard","--","app"],{cwd:ROOT,encoding:"utf8"}).trim().split(/\r?\n/).filter(Boolean),
  ];
  restoreProductPaths(observed);
  const read = io.read || (file=>fs.readFileSync(path.join(ROOT,file),"utf8"));
  const hash = text=>require("node:crypto").createHash("sha256").update(text.replace(/\r\n/g,"\n")).digest("hex");
  const result = [];
  for (const file of paths) {
    const restored = restoreBasic(file,read(file)).replace(/\r\n/g,"\n");
    const row = historical.files.find(x=>x.path===file);
    if (row) {
      if (hash(restored)!==row.candidateSha256) throw Error(`selected R3 historical candidate bytes mismatch: ${file}`);
      if (row.baseSha256!==null && hash(gitShow(historical.base,file))!==row.baseSha256) throw Error(`selected R3 historical base bytes mismatch: ${file}`);
      result.push(file);
    } else {
      // 고정 source의 정확한 역변환이 과거 base와 같을 때만 당시 변경이 없음을 증명한다.
      if (restored!==gitShow(historical.base,file)) throw Error(`selected R3 historical no-change proof mismatch: ${file}`);
    }
  }
  if (JSON.stringify(result.sort())!==JSON.stringify(historical.files.map(x=>x.path).sort())) throw Error("selected R3 historical result path set mismatch");
  return result;
}
function restoreProductPaths(paths) {
  const expected = [...new Set([...Object.keys(plan()), ...RELEASE_PATHS])].sort();
  if (paths.length !== new Set(paths).size || JSON.stringify([...paths].sort()) !== JSON.stringify(expected)) throw Error("selected R3 release exact22 path set mismatch");
  verifyCurrent();
  return Object.keys(plan()).sort();
}
function restoreCheckpointPaths(paths, baselinePaths) {
  const expected = [...new Set([...baselinePaths, ...CHECKPOINT_PATHS])].sort();
  if (paths.length !== new Set(paths).size || JSON.stringify([...paths].sort()) !== JSON.stringify(expected)) {
    throw Error("selected R3 checkpoint exact path set mismatch");
  }
  verifyCurrent();
  return [...baselinePaths].sort();
}
module.exports = {plan, releasePlan, restoreRelease, restore, verifyCurrent, verifyDocRegistration, restoreHistoricalAppPaths, restoreProductPaths, restoreCheckpointPaths, CHECKPOINT_PATHS, RELEASE_PATHS, DOC_POINTER};
