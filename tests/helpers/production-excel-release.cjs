// 기존 bump script로 기능 체크포인트에서 릴리스를 재계산한다. 실제 파일 변경 없음.
"use strict";
const fs = require("node:fs"), cp = require("node:child_process"), assert = require("node:assert/strict");
const normalize = s => s.replace(/\r\n/g, "\n");
const raw = p => normalize(fs.readFileSync(p, "utf8"));
const show = (sha, p) => normalize(cp.execFileSync("git", ["show", `${sha}:${p}`], {encoding:"utf8", maxBuffer:8e6}));
const contract = JSON.parse(raw("tests/fixtures/production-excel-release.json"));
assert.equal(contract.functionalCheckpoint, "f5dbdbdecc659b98cc0b9c0b629cee28f28ea713");
assert.equal(contract.base, "11e8928e369c9d9a4eedaa572102f75d1681602b");
assert.equal(contract.version, "1.0.536");
assert.equal(contract.releaseId, "2026.10.06.04");
assert.equal(raw("scripts/bump_release.py"), show(contract.base, "scripts/bump_release.py"));
const release = JSON.parse(raw("app/release.json"));
for (const key of ["version", "releaseId", "deployedAt"]) assert.equal(release[key], contract[key]);
const python = process.env.TENNISNOTE_PYTHON || (process.platform === "win32" ? "python" : "python3");
const plans = JSON.parse(cp.execFileSync(python, ["-c", String.raw`
import importlib.util, io, json, subprocess, sys, tarfile
from pathlib import Path
from unittest.mock import patch
c = json.load(sys.stdin)
spec = importlib.util.spec_from_file_location("bump", "scripts/bump_release.py")
b = importlib.util.module_from_spec(spec); spec.loader.exec_module(b)
with tarfile.open(fileobj=io.BytesIO(subprocess.check_output(["git", "archive", c["functionalCheckpoint"], "app"]))) as tar:
    originals = {m.name:tar.extractfile(m).read().decode("utf-8").replace("\r\n", "\n") for m in tar.getmembers()
                 if m.isfile() and Path(m.name).suffix in {".html", ".js", ".json"}}
old = json.loads(originals["app/release.json"])["version"]
assert old == "1.0.533"
def original(path, *args, **kwargs):
    p = path.relative_to(b.ROOT).as_posix()
    if p == "app/shared/config.local.js":
        assert not subprocess.check_output(["git", "ls-files", "--", p]).strip()
        subprocess.run(["git", "check-ignore", "-q", "--", p], check=True)
        return ""
    return originals[p]
merged, counts = {}, {}
def read(path): return merged.get(path, original(path))
def absorb(items):
    for p, text, count in items:
        merged[p] = text; counts[p] = counts.get(p,0)+count
with patch.object(Path, "read_text", original):
    absorb([b.plan_release_json(old,c["version"],c["releaseId"],c["deployedAt"])])
    absorb([b.plan_release_js(old,c["version"],c["releaseId"],c["deployedAt"])])
    absorb(b.plan_version_queries(old,c["version"],read))
    absorb(b.plan_app_literals(old,c["version"],read))
    cache = b.plan_cache_names(read)
    assert [x[4] for x in cache] == [c["memberCache"],c["coachCache"]]
    absorb([(p,t,n) for p,t,n,_,_ in cache])
    assert not b.leftover_old_version(merged, old)
assert sum(counts.values()) == 371
assert sum(bool(n) for n in counts.values()) == 13
print(json.dumps({p.relative_to(b.ROOT).as_posix():{"before":original(p),"after":t}
                  for p,t in merged.items() if counts.get(p)}))
`], {encoding:"utf8", input:JSON.stringify(contract), maxBuffer:8e6}));
for (const [p, plan] of Object.entries(plans)) assert.equal(raw(p), normalize(plan.after), `release drift: ${p}`);
function readBeforeRelease(p) { return plans[p] ? normalize(plans[p].before) : raw(p); }
module.exports = {readBeforeRelease, releasePaths:Object.keys(plans), contract, plans};
