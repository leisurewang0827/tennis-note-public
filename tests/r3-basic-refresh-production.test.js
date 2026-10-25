import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import path from "node:path";
import { execFileSync } from "node:child_process";
import successor from "./helpers/r3-basic-refresh-production.cjs";
import promotion from "./helpers/r3-production-promotion.cjs";

const root = process.cwd();
const read = file => fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
const git = (...args) => execFileSync("git", ["-c", "core.safecrlf=false", ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] }).replace(/\r\n/g, "\n");
const show = file => git("show", `${successor.contract.base}:${file}`);
const python = process.env.TENNISNOTE_PYTHON || (process.platform === "win32" ? "python" : "python3");
function py(body, input = "") {
  return execFileSync(python, ["-B", "-X", "utf8", "-c", body], { encoding: "utf8", input, maxBuffer: 16 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] });
}
function privateCommitExists(run, commit) {
  assert.equal(run(["rev-parse", "--is-inside-work-tree"]).trim(), "true", "valid private repository required");
  const line = run(["cat-file", "--batch-check=%(objectname) %(objecttype)"], `${commit}^{commit}\n`).trim();
  if (line === `${commit}^{commit} missing`) return false;
  assert.equal(line, `${commit} commit`, "unexpected Git object probe; do not classify as missing");
  return true;
}

test("BASIC556 new successor recomputes all16 blobs from actual224 plus exact3 and the unmodified official release tool", () => {
  successor.verifyCurrent();
  const plan = successor.plan();
  assert.equal(Object.keys(plan).length, 16);
  assert.equal(successor.contract.release.version, "1.0.556");
  assert.equal(successor.contract.release.releaseId, "2026.10.25.01");
  for (const row of successor.contract.files) {
    assert.equal(successor.hash(plan[row.path].after), row.candidateSha256);
    assert.equal(successor.hash(plan[row.path].before), row.baseSha256);
    assert.equal(git("rev-parse", `${successor.contract.base}:${row.path}`).trim(), row.baseBlob);
    assert.equal(successor.restoreSuccessor(row.path, read(row.path)), show(row.path));
  }
  assert.deepEqual(JSON.parse(read("app/release.json")).nativePlatforms, JSON.parse(show("app/release.json")).nativePlatforms);
  const native = text => text.slice(text.indexOf("    nativeShell:"));
  assert.notEqual(read("app/shared/tennisnote-release.js").indexOf("    nativeShell:"), -1);
  assert.equal(native(read("app/shared/tennisnote-release.js")), native(show("app/shared/tennisnote-release.js")));
});

test("BASIC556 rejects duplicate missing unknown paths, altered hashes and source/release/cache/environment scope", () => {
  const result = py(String.raw`
import copy, importlib.util, json, socket
def forbidden(*a,**k):raise AssertionError("network forbidden")
socket.create_connection=forbidden
socket.socket.connect=forbidden
socket.socket.connect_ex=forbidden
spec=importlib.util.spec_from_file_location("alignment", "scripts/check_tennisnote_dev_prod_alignment.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
c=json.loads(m.BASIC_REFRESH_PATH.read_text(encoding="utf-8"))
cases=[]
def changed(fn):
    x=copy.deepcopy(c);fn(x);cases.append(x)
changed(lambda x:x.update(base="0"*40))
changed(lambda x:x["files"].__setitem__(0,copy.deepcopy(x["files"][1])))
changed(lambda x:x["files"].pop())
changed(lambda x:x["files"][0].update(path="app/unknown.js"))
changed(lambda x:x["files"][0].update(baseBlob="0"*40))
changed(lambda x:x["files"][0].update(baseSha256="0"*64))
changed(lambda x:x["files"][0].update(candidateSha256="0"*64))
changed(lambda x:x["privateAuthority"].update(tree="0"*40))
changed(lambda x:x["privateAuthority"].update(functionSource=x["privateAuthority"]["functionSource"]+" "))
changed(lambda x:x["release"].update(version="1.0.554"))
changed(lambda x:x["release"].update(releaseId="2026.10.24.01"))
changed(lambda x:x["release"].update(memberCache="tennis-note-member-pwa-v589"))
changed(lambda x:x["release"].update(coachCache="tennis-note-coach-mode-v562"))
changed(lambda x:x["release"].update(runtime="development"))
changed(lambda x:x["release"].update(fingerprint="0"*64))
changed(lambda x:x["release"].update(officialReplacementCount=373))
for x in cases:
    try:m.basic_refresh_plan(x)
    except RuntimeError:pass
    else:raise AssertionError("mutated contract accepted")
old=m.BASIC_REFRESH_PRODUCTS["app/tennis-note-coach-app/ui/screens.js"]
m.BASIC_REFRESH_PRODUCTS["app/tennis-note-coach-app/ui/screens.js"]=(old[0],old[1]+" ")
try:m.basic_refresh_plan(c)
except RuntimeError:pass
else:raise AssertionError("modified product hunk accepted")
print(len(cases)+1)
`);
  assert.equal(result.trim(), "17");
  const paths = successor.contract.files.map(row => row.path);
  assert.throws(() => successor.assertPathSet(paths.slice(1)), /path set/);
  assert.throws(() => successor.assertPathSet([...paths.slice(1), paths[1]]), /path set/);
  assert.throws(() => successor.assertPathSet([...paths.slice(1), "app/unknown.js"]), /path set/);
  for (const row of successor.contract.files) assert.throws(() => successor.restoreSuccessor(row.path, read(row.path) + " "), /exact candidate mismatch/);
});

test("BASIC556 is actually consumed before historical JS and Python553 guards, without changing goldens", () => {
  const old = JSON.parse(read("tests/fixtures/r3-production-promotion.json"));
  for (const row of successor.contract.files) {
    const oldRow = old.files.find(item => item.path === row.path);
    const expected = !oldRow ? show(row.path) : oldRow.baseSha256 === null ? "" : git("show", `${old.base}:${row.path}`);
    assert.equal(promotion.restoreBeforeR3(row.path, read(row.path)), expected, row.path);
  }
  const result = py(String.raw`
import importlib.util,json,subprocess
from pathlib import Path
spec=importlib.util.spec_from_file_location("alignment","scripts/check_tennisnote_dev_prod_alignment.py")
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
new=json.loads(m.BASIC_REFRESH_PATH.read_text(encoding="utf-8"))
for row in new["files"]:
    file=row["path"]
    old=next((r for r in m.R3_PROMOTION_CONTRACT["files"] if r["path"]==file),None)
    expected=b"" if old and old["baseSha256"] is None else subprocess.check_output(["git","show",(m.R3_PROMOTION_CONTRACT["base"] if old else new["base"])+":"+file]).replace(b"\r\n",b"\n")
    assert m.before_r3_candidate(file,Path(file).read_bytes())==expected,file
print("python-actual-consumer16")
`);
  assert.equal(result.trim(), "python-actual-consumer16");
  for (const file of ["tests/fixtures/r3-production-promotion.json", "tests/fixtures/self-profile-a-only.json", "tests/fixtures/production-isolation-source.json", "tests/fixtures/production-excel-release.json", "scripts/verify.sh", ".github/workflows/tennisnote-public-ci.yml", ".github/workflows/deploy-cloudflare-pages.yml", ".github/workflows/deploy-pages.yml"]) assert.equal(read(file), show(file), file);
  assert.match(read("tests/r3-production-candidate.test.js"), /const read = path => promotion\.restoreSuccessor\(path,/);
  assert.match(read("tests/r3-production-promotion.test.js"), /promotion\.sha256\(promotion\.restoreSuccessor\(file, candidate\)\), candidateSha/);
});

test("BASIC556 frozen private source projects only the existing open-owner behavior", () => {
  const source = successor.contract.privateAuthority;
  const screen = read("app/tennis-note-coach-app/ui/screens.js");
  const start = screen.indexOf("function openCoachSettlement(");
  const end = screen.indexOf("\n}", start) + 2;
  const actual = screen.slice(start, end);
  assert.equal(actual.replace(source.publicHistoryPreserved, ""), source.functionSource);
  assert.equal(successor.hash(source.functionSource), source.functionSha256);
  assert.equal((actual.match(/void syncCoachSettlementFromServer\(\)/g) || []).length, 1);
});

test("BASIC556 actual cross-repository equivalent Git objects match frozen tree blob and function", t => {
  const privateRoot = process.env.TENNISNOTE_R3_PRIVATE_AUTHORITY_REPO;
  if (!privateRoot) return t.skip("Private checkout unavailable: actual cross-repository Git proof SKIPPED, frozen source test is separate.");
  const source = successor.contract.privateAuthority;
  const pg = (...args) => execFileSync("git", args, { cwd: privateRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).replace(/\r\n/g, "\n").trim();
  assert.equal(pg("rev-parse", `${source.equivalentCommit}^{tree}`), source.tree);
  assert.equal(pg("rev-parse", `${source.equivalentCommit}:${source.path}`), source.blob);
  assert.ok(pg("show", `${source.equivalentCommit}:${source.path}`).includes(source.functionSource));
});

test("BASIC556 actual private main896 Git objects match the equivalent source", t => {
  const privateRoot = process.env.TENNISNOTE_R3_PRIVATE_AUTHORITY_REPO;
  if (!privateRoot) return t.skip("Private checkout unavailable: actual main896 Git proof SKIPPED, no fetch.");
  const source = successor.contract.privateAuthority;
  const run = (args, input) => execFileSync("git", args, { cwd: privateRoot, input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
  if (!privateCommitExists(run, source.main)) return t.skip("main896 exact batch-check missing in valid repository: no fetch; saved remote-tree proof is not a new actual Git PASS.");
  const pg = (...args) => execFileSync("git", args, { cwd: privateRoot, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 }).replace(/\r\n/g, "\n").trim();
  assert.equal(pg("rev-parse", `${source.main}^{tree}`), source.tree);
  assert.equal(pg("rev-parse", `${source.main}:${source.path}`), source.blob);
  assert.ok(pg("show", `${source.main}:${source.path}`).includes(source.functionSource));
});

test("BASIC556 missing Git-object disposition never masks repository permission or corruption errors", () => {
  const commit = successor.contract.privateAuthority.main;
  const fake = value => (args, input) => {
    if (args[0] === "rev-parse") return "true\n";
    assert.deepEqual(args, ["cat-file", "--batch-check=%(objectname) %(objecttype)"]);
    assert.equal(input, `${commit}^{commit}\n`);
    if (value instanceof Error) throw value;
    return value;
  };
  assert.equal(privateCommitExists(fake(`${commit}^{commit} missing\n`), commit), false);
  assert.equal(privateCommitExists(fake(`${commit} commit\n`), commit), true);
  assert.throws(() => privateCommitExists(fake("unexpected probe output\n"), commit), /unexpected Git object probe/);
  assert.throws(() => privateCommitExists(fake(new Error("synthetic permission denied")), commit), /permission denied/);
  assert.throws(() => privateCommitExists(() => { throw new Error("synthetic repository corrupt"); }, commit), /repository corrupt/);
  assert.throws(() => privateCommitExists(() => "false\n", commit), /valid private repository required/);
});

test("BASIC556 exact23-file collector registration preserves all other production tracked paths", () => {
  const verification = ["tests/fixtures/r3-basic-refresh-production.json", "tests/helpers/r3-basic-refresh-production.cjs", "tests/r3-basic-refresh-production.test.js", "tests/helpers/r3-production-promotion.cjs", "scripts/check_tennisnote_dev_prod_alignment.py", "tests/r3-production-candidate.test.js", "tests/r3-production-promotion.test.js"];
  const expected = [...successor.contract.files.map(row => row.path), ...verification].sort();
  assert.equal(new Set(expected).size, 23);
  const actual = git("diff", "--name-only", successor.contract.base).trim().split("\n").filter(Boolean);
  actual.push(...git("ls-files", "--others", "--exclude-standard").trim().split("\n").filter(Boolean));
  assert.deepEqual(actual.sort(), expected);
  assert.match(read("scripts/verify.sh"), /node --test "tests\/\*\*\/\*\.test\.js"/);
  assert.equal(path.basename(import.meta.filename), "r3-basic-refresh-production.test.js");
  for (const row of successor.contract.files) if (row.path.endsWith(".js")) new vm.Script(read(row.path), { filename: row.path });
  assert.equal(read("app/tennis-note-coach-app/data/sync.js"), show("app/tennis-note-coach-app/data/sync.js"));
});
