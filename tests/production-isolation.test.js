// 운영 기준을 보존한 최소 이식 증명. 배포나 DB 접근을 하지 않는다.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import releaseGuard from "./helpers/production-excel-release.cjs";
const norm = s => s.replace(/\r\n/g, "\n");
const read = p => releaseGuard.readBeforeRelease(p);
const hash = s => crypto.createHash("sha256").update(s).digest("hex");
const manifest = JSON.parse(read("tests/fixtures/production-isolation-source.json"));
const refresh = JSON.parse(read("tests/fixtures/production-excel-refresh-source.json"));
// 기존 13경로 증명을 그대로 유지하고, 새 두 경로는 먼저 exact 역이식한다.
function priorSource(path) {
  let current = read(path);
  const selected = refresh.products.find(row => row.path === path);
  if (!selected) return current;
  assert.equal(hash(current), selected.candidateSha256, path);
  for (const h of [...selected.hunks].reverse()) {
    assert.equal(current.split(h.after).length, 2, path);
    current = current.replace(h.after, () => h.before);
  }
  assert.equal(hash(current), selected.baseSha256, path);
  return current;
}
const show = p => norm(execFileSync("git", ["show", manifest.base + ":" + p], { encoding: "utf8", maxBuffer: 8e6 }));
const approvedSources = new Map(manifest.products.map(f => {
  let source = show(f.path);
  assert.equal(hash(source), f.baseSha256, f.path);
  for (const h of f.hunks) {
    assert.equal(source.split(h.before).length, 2, f.path);
    source = source.replace(h.before, () => h.after);
  }
  assert.equal(hash(source), f.candidateSha256, f.path);
  return [f.path, source];
}));
const release = JSON.parse(read("app/release.json"));
const baseRelease = JSON.parse(show("app/release.json"));
// 허용 경로를 넓히지 않는다. 기존 스크립트로 승인 hunk 위의 릴리스 결과를 재계산한다.
assert.equal(read("scripts/bump_release.py"), show("scripts/bump_release.py"));
const releaseHashes = release.version === baseRelease.version ? {} : (() => {
  assert.equal(release.version, "1.0.533");
  assert.equal(release.releaseId, "2026.10.06.01");
  assert.match(release.deployedAt, /^2026-10-06T\d{2}:\d{2}:\d{2}\+09:00$/);
  const python = process.env.TENNISNOTE_PYTHON || (process.platform === "win32" ? "python" : "python3");
  return JSON.parse(execFileSync(python, ["-c", String.raw`
import hashlib, importlib.util, io, json, subprocess, sys, tarfile
from pathlib import Path
from unittest.mock import patch
payload = json.load(sys.stdin)
spec = importlib.util.spec_from_file_location("release_bump", "scripts/bump_release.py")
bump = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bump)
archive = subprocess.check_output(["git", "archive", payload["base"], "app"])
with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
    originals = {m.name: tar.extractfile(m).read().decode("utf-8").replace("\r\n", "\n")
                 for m in tar.getmembers() if m.isfile() and Path(m.name).suffix in {".html", ".js", ".json"}}
originals.update(payload["sources"])
def original(path, *args, **kwargs):
    relative = path.relative_to(bump.ROOT).as_posix()
    # 배포 시 생성하는 로컬 설정은 커밋 원본도 릴리스 치환 대상도 아니다. 값은 읽지 않는다.
    if relative == "app/shared/config.local.js":
        assert not subprocess.check_output(["git", "ls-files", "--", relative]).strip()
        subprocess.run(["git", "check-ignore", "-q", "--", relative], check=True)
        return ""
    return originals[relative]
merged, counts = {}, {}
def read(path):
    return merged.get(path, original(path))
def absorb(plans):
    for path, text, count in plans:
        merged[path] = text
        counts[path] = counts.get(path, 0) + count
r = payload["release"]
with patch.object(Path, "read_text", original):
    absorb([bump.plan_release_json(payload["old"], r["version"], r["releaseId"], r["deployedAt"])])
    absorb([bump.plan_release_js(payload["old"], r["version"], r["releaseId"], r["deployedAt"])])
    absorb(bump.plan_version_queries(payload["old"], r["version"], read))
    absorb(bump.plan_app_literals(payload["old"], r["version"], read))
    absorb([(p, t, c) for p, t, c, _, _ in bump.plan_cache_names(read)])
print(json.dumps({p.relative_to(bump.ROOT).as_posix(): hashlib.sha256(t.encode()).hexdigest()
                  for p, t in merged.items() if counts.get(p)}))
`], { encoding: "utf8", maxBuffer: 8e6, input: JSON.stringify({ base: manifest.base, old: baseRelease.version, release, sources: Object.fromEntries(approvedSources) }) }));
})();
test("운영 분리: 정확한 13제품 경로·hunk 외 원본 보존·신규 RPC 없음", () => {
  assert.equal(manifest.base, "648ac3387f11ad65e7631ad32e4a9a06b511d49c");
  assert.equal(manifest.products.length, 13);
  const changed = execFileSync("git", ["diff", "--name-only", manifest.base, "--", "app"], { encoding: "utf8" }).trim().split("\n").sort();
  assert.deepEqual(changed, [...new Set([...approvedSources.keys(), ...Object.keys(releaseHashes), ...refresh.products.map(row => row.path)])].sort());
  for (const [path, expected] of Object.entries(releaseHashes)) assert.equal(hash(priorSource(path)), expected, `release-only drift: ${path}`);
  const rpcNames = text => [...text.matchAll(/\.rpc\(\s*["']([^"']+)["']/g)].map(m => m[1]);
  const oldCalls = new Set(manifest.products.flatMap(f => rpcNames(show(f.path))));
  for (const f of manifest.products) {
    assert.equal(hash(priorSource(f.path)), releaseHashes[f.path] || f.candidateSha256, f.path);
    let current = approvedSources.get(f.path);
    assert.equal(hash(current), f.candidateSha256, f.path);
    for (const name of rpcNames(current)) assert(oldCalls.has(name), `new RPC forbidden: ${name}`);
    for (const h of [...f.hunks].reverse()) {
      assert.equal(current.split(h.after).length, 2, f.path);
      current = current.replace(h.after, () => h.before);
    }
    assert.equal(current, show(f.path), `unrelated hunk: ${f.path}`);
    assert.equal(hash(current), f.baseSha256);
  }
});
test("운영 분리: script 릴리스 외 runtime/deploy/SQL/Edge/Auth/native 원본 유지", () => {
  for (const p of ["app/release.json", "app/shared/tennisnote-release.js", "app/shared/tennisnote-data-client.js", "app/shared/tennisnote-single-sheet-snapshot.js", "app/shared/tennisnote-single-sheet-transport.js", "app/shared/tennisnote-single-sheet-import.js", ".github/workflows/deploy-cloudflare-pages.yml"]) assert.equal(hash(read(p)), releaseHashes[p] || hash(show(p)), p);
  assert.deepEqual(release.nativePlatforms, baseRelease.nativePlatforms);
  assert.match(read(".github/workflows/deploy-cloudflare-pages.yml"), /^\s+TENNISNOTE_SINGLE_SHEET_IMPORT_REVERSE_ENABLED: "false"$/m);
  for (const name of ["enterMemberCurriculum", "leaveMemberCurriculum", "curriculumSessionAttempt", "memberCurriculumUI"]) {
    for (const f of manifest.products) {
      const count = s => s.split(name).length - 1;
      assert.equal(count(read(f.path)), count(show(f.path)), `${name}: ${f.path}`);
    }
  }
});
