"use strict";
// 새 선별층의 기계적 소스만 먼저 검증한다. 기존 BASIC/553 기대값은 변경하지 않는다.
const fs = require("node:fs"), path = require("node:path");
const {execFileSync} = require("node:child_process");
const ROOT = path.resolve(__dirname, "../..");
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
  "tests/fixtures/r3-production-selected-release.json", ...RELEASE_PATHS,
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
function verifyCurrent() {
  for (const [file,row] of Object.entries(releasePlan())) {
    if (fs.readFileSync(path.join(ROOT,file),"utf8").replace(/\r\n/g,"\n") !== row.after) throw Error(`selected R3 release exact candidate mismatch: ${file}`);
  }
  for (const [file,row] of Object.entries(plan())) {
    const current = restoreRelease(file,fs.readFileSync(path.join(ROOT,file),"utf8"));
    if (current !== row.after) throw Error(`selected R3 exact candidate mismatch: ${file}`);
  }
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
module.exports = {plan, releasePlan, restoreRelease, restore, verifyCurrent, restoreProductPaths, restoreCheckpointPaths, CHECKPOINT_PATHS, RELEASE_PATHS};
