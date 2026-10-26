"use strict";
// 새 선별층의 기계적 소스만 먼저 검증한다. 기존 BASIC/553 기대값은 변경하지 않는다.
const fs = require("node:fs"), path = require("node:path");
const {execFileSync} = require("node:child_process");
const ROOT = path.resolve(__dirname, "../..");
const CHECKPOINT_PATHS = [
  "app/admin/actions/billing.js", "app/admin/data/billing.js", "app/admin/events/billing.js",
  "app/admin/index.html", "app/admin/views/billing.js",
  "app/tennis-note-coach-app/data/sync.js", "app/tennis-note-coach-app/domain/settlement.js",
  "app/tennis-note-coach-app/events/account.js", "app/tennis-note-coach-app/index.html",
  "app/tennis-note-coach-app/styles.css", "app/tennis-note-coach-app/views/settlement.js",
  "scripts/check_tennisnote_dev_prod_alignment.py", "scripts/check_r3_production_selected_browser.cjs",
  "tests/fixtures/r3-production-selected-source.json", "tests/helpers/r3-production-selected.cjs",
  "tests/helpers/r3-basic-refresh-production.cjs", "tests/r3-basic-refresh-production.test.js",
  "tests/r3-production-selected.test.js", "docs/tennisnote-r3-production-selected-local.md",
];
let cached;
function plan() {
  if (!cached) {
    const python = process.env.TENNISNOTE_PYTHON || (process.platform === "win32" ? "python" : "python3");
    cached = JSON.parse(execFileSync(python, ["-B", "-X", "utf8", "-c", String.raw`
import importlib.util,json
spec=importlib.util.spec_from_file_location("alignment","scripts/check_tennisnote_dev_prod_alignment.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
print(json.dumps(m.selected_r3_plan(),ensure_ascii=True))
`], {cwd:ROOT,encoding:"utf8",maxBuffer:16*1024*1024,stdio:["ignore","pipe","pipe"]}));
  }
  return cached;
}
function restore(file, text) {
  const row = plan()[file], current = text.replace(/\r\n/g,"\n");
  if (!row || current === row.before) return current;
  if (current !== row.after) throw Error(`selected R3 exact candidate mismatch: ${file}`);
  return row.before;
}
function verifyCurrent() {
  for (const [file,row] of Object.entries(plan())) {
    const current = fs.readFileSync(path.join(ROOT,file),"utf8").replace(/\r\n/g,"\n");
    if (current !== row.after) throw Error(`selected R3 exact candidate mismatch: ${file}`);
  }
}
function restoreCheckpointPaths(paths, baselinePaths) {
  const expected = [...new Set([...baselinePaths, ...CHECKPOINT_PATHS])].sort();
  if (paths.length !== new Set(paths).size || JSON.stringify([...paths].sort()) !== JSON.stringify(expected)) {
    throw Error("selected R3 checkpoint exact path set mismatch");
  }
  verifyCurrent();
  return [...baselinePaths].sort();
}
module.exports = {plan, restore, verifyCurrent, restoreCheckpointPaths, CHECKPOINT_PATHS};
