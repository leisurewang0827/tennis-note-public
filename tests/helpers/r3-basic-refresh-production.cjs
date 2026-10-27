"use strict";
// 새 BASIC 층만 기계적으로 검증한 뒤 기존553 원본을 반환한다. 역사 golden은 그대로다.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const selected = require("./r3-production-selected.cjs");
const ROOT = path.resolve(__dirname, "../..");
const contract = JSON.parse(fs.readFileSync(path.join(ROOT, "tests/fixtures/r3-basic-refresh-production.json"), "utf8"));
const normalize = text => text.replace(/\r\n/g, "\n");
const hash = text => crypto.createHash("sha256").update(normalize(text)).digest("hex");
let mechanicalPlan;
function verifyPlan(value = contract) {
  const python = process.env.TENNISNOTE_PYTHON || (process.platform === "win32" ? "python" : "python3");
  return JSON.parse(execFileSync(python, ["-B", "-X", "utf8", "-c", String.raw`
import importlib.util,json,sys
spec=importlib.util.spec_from_file_location("alignment", "scripts/check_tennisnote_dev_prod_alignment.py")
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
print(json.dumps(m.basic_refresh_plan(json.load(sys.stdin)),ensure_ascii=True))
`], { cwd: ROOT, encoding: "utf8", input: JSON.stringify(value), maxBuffer: 16 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] }));
}
function plan() {
  if (!mechanicalPlan) mechanicalPlan = verifyPlan();
  return mechanicalPlan;
}
function restoreSuccessor(file, text) {
  const row = plan()[file];
  const current = selected.restore(file, text);
  if (!row) return current;
  if (current !== row.after) throw Error(`BASIC refresh exact candidate mismatch: ${file}`);
  return row.before;
}
function assertPathSet(paths) {
  const expected = Object.keys(plan()).sort();
  const withSelected = [...new Set([...expected, ...Object.keys(selected.plan())])].sort();
  if(paths.includes("app/tennis-note-coach-app/data/auth.js")&&!withSelected.includes("app/tennis-note-coach-app/data/auth.js")) paths=require("./r3-self-coach.cjs").resolvePaths(paths,withSelected);
  const actual = JSON.stringify([...paths].sort());
  if (paths.length !== new Set(paths).size || (actual !== JSON.stringify(expected) && actual !== JSON.stringify(withSelected))) {
    throw Error("BASIC refresh exact path set mismatch");
  }
  if (actual === JSON.stringify(withSelected)) selected.verifyCurrent();
}
function verifyCurrent() {
  selected.verifyCurrent();
  for (const [file, row] of Object.entries(plan())) {
    if (selected.restore(file, fs.readFileSync(path.join(ROOT, file), "utf8")) !== row.after) throw Error(`BASIC refresh exact candidate mismatch: ${file}`);
  }
  const paths = execFileSync("git", ["-c", "core.safecrlf=false", "diff", "--name-only", contract.base, "--", "app"], { cwd: ROOT, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean);
  paths.push(...execFileSync("git", ["ls-files", "--others", "--exclude-standard", "--", "app"], { cwd: ROOT, encoding: "utf8" }).trim().split(/\r?\n/).filter(Boolean));
  assertPathSet(paths);
}
module.exports = { contract, normalize, hash, verifyPlan, plan, restoreSuccessor, assertPathSet, verifyCurrent };
