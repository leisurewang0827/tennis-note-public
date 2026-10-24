import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import promotion from "./helpers/r3-production-promotion.cjs";
import payoutLayer from "./helpers/r3-layered-historical-source.cjs";

test("R3 inverse restores only exact pinned files and rejects drift", () => {
  for (const [file, baseSha, candidateSha] of promotion.files) {
    const candidate = payoutLayer.restoreBeforeManualPayoutLayer(file, fs.readFileSync(file, "utf8"));
    assert.equal(promotion.sha256(candidate), candidateSha, file);
    const restored = promotion.restoreBeforeR3(file, candidate);
    if (baseSha) assert.equal(promotion.sha256(restored), baseSha, file);
    else assert.equal(restored, "", file);
  }
  const [file] = promotion.files[0];
  const layeredCandidate = payoutLayer.restoreBeforeManualPayoutLayer(file, fs.readFileSync(file, "utf8"));
  assert.throws(() => promotion.restoreBeforeR3(file, `${layeredCandidate} `), /exact candidate mismatch/);
  assert.equal(promotion.restoreBeforeR3("tests/not-in-r3.txt", "untouched\r\n"), "untouched\n");
});

test("R3 live development read guard retries only known transient GET failures once", () => {
  const python = process.env.TENNISNOTE_PYTHON || (process.platform === "win32" ? "python" : "python3");
  const script = [
    "import importlib.util, io, json, socket, ssl, urllib.error, urllib.request",
    "from unittest.mock import patch",
    "spec=importlib.util.spec_from_file_location('devgate','scripts/check_r3_dev_deployment.py')",
    "m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)",
    "sha='a'*40",
    "assert m._NoRedirectHandler().redirect_request(None,None,302,'Found',{},'https://other.invalid/') is None",
    "class Response:",
    "    def __init__(self, body): self.body=body",
    "    def __enter__(self): return self",
    "    def __exit__(self,*args): return False",
    "    def read(self,limit): return self.body",
    "def http_error(status): return urllib.error.HTTPError('https://redacted.invalid', status, 'synthetic-private-reason', {}, io.BytesIO(b''))",
    "for status in (502,503,504):",
    "    with patch.object(m._LIVE_READ_OPENER,'open',side_effect=[http_error(status),Response(b'{\\\"version\\\":\\\"1.0.552\\\"}')]) as opened:",
    "        assert m._http_read('member_release',sha)=={'version':'1.0.552'}",
    "        assert opened.call_count==2",
    "        for call in opened.call_args_list:",
    "            request=call.args[0]",
    "            assert request.get_method()=='GET'",
    "            assert request.full_url==f'{m.DEV_MEMBER_ORIGIN}/release.json?__tn_preflight={sha}'",
    "            assert request.get_header('User-agent')=='TennisNote-Release-Preflight/1.0'",
    "            assert call.kwargs.get('timeout')==15",
    "with patch.object(m._LIVE_READ_OPENER,'open',side_effect=[ConnectionResetError('synthetic-private-reset'),Response(b'{\\\"version\\\":\\\"1.0.552\\\"}')]) as opened:",
    "    assert m._http_read('member_release',sha)=={'version':'1.0.552'}",
    "    assert opened.call_count==2",
    "for status in (302,403,404):",
    "    refused=http_error(status)",
    "    with patch.object(m._LIVE_READ_OPENER,'open',side_effect=refused) as opened:",
    "        try: m._http_read('admin_release',sha)",
    "        except RuntimeError as exc:",
    "            message=str(exc)",
    "            assert f'endpoint=admin_release reason=HTTP_STATUS status={status}' in message",
    "            assert 'redacted.invalid' not in message and 'synthetic-private-reason' not in message",
    "        else: raise AssertionError('permanent HTTP status accepted')",
    "        assert opened.call_count==1",
    "        assert refused.fp.closed",
    "with patch.object(m._LIVE_READ_OPENER,'open',side_effect=urllib.error.URLError(OSError('synthetic other detail'))) as opened:",
    "    try: m._http_read('admin_release',sha)",
    "    except RuntimeError as exc:",
    "        assert 'endpoint=admin_release reason=OTHER' in str(exc)",
    "        assert 'synthetic other detail' not in str(exc)",
    "    else: raise AssertionError('unclassified network failure accepted')",
    "    assert opened.call_count==1",
    "with patch.object(m._LIVE_READ_OPENER,'open',side_effect=[TimeoutError('synthetic-private-detail')]*3) as opened:",
    "    try: m._http_read('member_worker',sha)",
    "    except RuntimeError as exc:",
    "        message=str(exc)",
    "        assert 'endpoint=member_worker reason=TIMEOUT' in message",
    "        assert 'synthetic-private-detail' not in message and 'tennisnote-app-dev.pages.dev' not in message",
    "    else: raise AssertionError('repeated transient read accepted')",
    "    assert opened.call_count==2",
    "with patch.object(m._LIVE_READ_OPENER,'open',side_effect=[urllib.error.URLError(socket.gaierror(socket.EAI_AGAIN,'synthetic DNS detail')),Response(b'{\\\"version\\\":\\\"1.0.552\\\"}')]) as opened:",
    "    assert m._http_read('member_release',sha)=={'version':'1.0.552'}",
    "    assert opened.call_count==2",
    "with patch.object(m._LIVE_READ_OPENER,'open',side_effect=urllib.error.URLError(socket.gaierror(socket.EAI_NONAME,'synthetic DNS detail'))) as opened:",
    "    try: m._http_read('coach_worker',sha)",
    "    except RuntimeError as exc:",
    "        assert 'endpoint=coach_worker reason=DNS_PERMANENT' in str(exc)",
    "        assert 'synthetic DNS detail' not in str(exc)",
    "    else: raise AssertionError('permanent DNS failure accepted')",
    "    assert opened.call_count==1",
    "with patch.object(m._LIVE_READ_OPENER,'open',side_effect=urllib.error.URLError(ssl.SSLCertVerificationError('synthetic certificate detail'))) as opened:",
    "    try: m._http_read('admin_release',sha)",
    "    except RuntimeError as exc:",
    "        assert 'endpoint=admin_release reason=TLS_CERT' in str(exc)",
    "        assert 'synthetic certificate detail' not in str(exc)",
    "    else: raise AssertionError('TLS certificate failure accepted')",
    "    assert opened.call_count==1",
    "with patch.object(m._LIVE_READ_OPENER,'open',return_value=Response(b'{')) as opened:",
    "    try: m._http_read('member_release',sha)",
    "    except RuntimeError as exc: assert 'endpoint=member_release reason=MALFORMED_BODY' in str(exc)",
    "    else: raise AssertionError('malformed response accepted')",
    "    assert opened.call_count==1",
    "with patch.object(m._LIVE_READ_OPENER,'open',return_value=Response(b'x'*1_000_001)) as opened:",
    "    try: m._http_read('member_worker',sha)",
    "    except RuntimeError as exc: assert 'endpoint=member_worker reason=BODY_TOO_LARGE' in str(exc)",
    "    else: raise AssertionError('oversized response accepted')",
    "    assert opened.call_count==1",
    "with patch.object(m._LIVE_READ_OPENER,'open') as opened:",
    "    try: m._http_read('https://untrusted.invalid/path',sha)",
    "    except RuntimeError: pass",
    "    else: raise AssertionError('unrecognized endpoint role accepted')",
    "    assert opened.call_count==0",
    "calls=[]",
    "def fake_read(role,candidate):",
    "    calls.append((role,candidate))",
    "    return {'member_release':{'version':'1.0.552','releaseId':'2026.10.20.03'},'admin_release':{'version':'1.0.552','releaseId':'2026.10.20.03'},'member_worker':'const CACHE_NAME = \\\"tennis-note-member-pwa-v588\\\";','coach_worker':'const CACHE_NAME = \\\"tennis-note-coach-mode-v561\\\";'}[role]",
    "with patch.object(m,'_http_read',side_effect=fake_read): states=m.read_live_dev_states(sha)",
    "assert calls==[(role,sha) for role in ('member_release','admin_release','member_worker','coach_worker')]",
    "assert len(states)==2 and all(state['member_cache']==588 and state['coach_cache']==561 for state in states)",
    "print('transient bounded retry; permanent no retry; exact unique GET endpoints; safe reason contract PASS')",
  ].join("\n");
  const result = execFileSync(python, ["-B", "-X", "utf8", "-c", script], { encoding: "utf8" }).trim();
  assert.match(result, /transient bounded retry/);
});

test("Python dev-prod alignment uses the same exact R3 source inverse", () => {
  const python = process.env.TENNISNOTE_PYTHON || (process.platform === "win32" ? "python" : "python3");
  const script = String.raw`
import importlib.util, json, subprocess
from pathlib import Path
spec=importlib.util.spec_from_file_location("alignment", "scripts/check_tennisnote_dev_prod_alignment.py")
module=importlib.util.module_from_spec(spec); spec.loader.exec_module(module)
for row in module.R3_PROMOTION_CONTRACT["files"]:
    path=row["path"]
    candidate=Path(path).read_bytes()
    restored=module.before_r3_candidate(path,candidate)
    if row["baseSha256"] is None:
        assert restored == b"", path
    else:
        expected=subprocess.check_output(["git","show",f"{module.R3_PROMOTION_CONTRACT['base']}:{path}"])
        assert restored == expected.replace(b"\r\n",b"\n"), path
discovered = sorted(path.relative_to(module.ROOT).as_posix() for path in (module.ROOT / "app").rglob("*") if path.is_file() and path.name != "config.local.js")
admitted = module.product_app_paths()
assert set(discovered) - set(admitted) == module.R3_NEW_PATHS
assert set(admitted) <= set(discovered)
print(len(module.R3_PROMOTION_CONTRACT["files"]))
`;
  const count = execFileSync(python, ["-B", "-X", "utf8", "-c", script], { encoding: "utf8" }).trim();
  assert.equal(count, String(promotion.files.length));
});

test("R3 dev deployment admission rejects wrong candidate, runtime, target, rollback, and release order", () => {
  const python = process.env.TENNISNOTE_PYTHON || (process.platform === "win32" ? "python" : "python3");
  const script = String.raw`
import importlib.util, tempfile, json
from pathlib import Path
from unittest.mock import patch
import re
workflow=Path(".github/workflows/deploy-cloudflare-pages-dev.yml").read_text(encoding="utf-8")
assert "vars.DEV_CLOUDFLARE_ACCOUNT_FINGERPRINT" in workflow
assert "vars.TENNISNOTE_DEV_PROJECT_FINGERPRINT" not in workflow
assert "vars.TENNISNOTE_DEV_CF_TARGET_FINGERPRINT" not in workflow
assert not re.search(r"(?im)^\s*(?:npx\s+[^\n]*wrangler[^\n]*\s+pages\s+project\s+create|.*(?:POST|PUT)\s+.*pages/projects)", workflow)
assert workflow.count("--project-name=tennisnote-app-dev --branch=dev") == 1
assert workflow.count("--project-name=tennisnote-admin-dev --branch=dev") == 1
spec=importlib.util.spec_from_file_location("devgate", "scripts/check_r3_dev_deployment.py")
m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
sha="a"*40
workflow_ref=m.EXPECTED_WORKFLOW_REF
good=dict(event_name="workflow_dispatch", ref=f"refs/heads/{m.EXPECTED_BRANCH}", ref_type="branch", workflow_ref=workflow_ref, workflow_name=m.EXPECTED_WORKFLOW_NAME, candidate_sha=sha, github_sha=sha, head_sha=sha)
m.validate_dispatch_context(**good)
for key, value in (("ref", "refs/heads/main"), ("workflow_ref", "other/workflow"), ("workflow_name", "wrong"), ("candidate_sha", "b"*40), ("event_name", "push")):
    bad=dict(good); bad[key]=value
    try: m.validate_dispatch_context(**bad)
    except RuntimeError: pass
    else: raise AssertionError(f"dispatch accepted {key}")
account="4"*32
account_fp=m.sha256(account.encode())
good_deploy={"id":"aaaaaaaa-1111-2222-3333-444444444444","environment":"production","deployment_trigger":{"metadata":{"branch":"dev","commit_hash":sha}},"latest_stage":{"status":"success"},"url":"https://preview.tennisnote-app-dev.pages.dev","created_on":"2026-10-20T00:00:00Z"}
assert m.rollback_proof("tennisnote-app-dev", [good_deploy])["commit_sha"] == sha
for deployments in ([], [dict(good_deploy, deployment_trigger={"metadata":{"branch":"main","commit_hash":sha}})], [dict(good_deploy, environment="preview")]):
    try: m.rollback_proof("tennisnote-app-dev", deployments)
    except RuntimeError: pass
    else: raise AssertionError("missing safe rollback proof accepted")
m.validate_cache_floor_provenance()
assert (m.EXPECTED_MEMBER_CACHE,m.EXPECTED_COACH_CACHE)==(589,562)
m.verify_monotonic_release({"version":"1.0.553","releaseId":"2026.10.21.01"},589,562,[{"release":{"version":"1.0.552","releaseId":"2026.10.20.01"},"member_cache":588,"coach_cache":561},{"release":{"version":"1.0.547","releaseId":"2026.10.09.04"},"member_cache":564,"coach_cache":537}])
try: m.verify_monotonic_release({"version":"1.0.553","releaseId":"2026.10.21.01"},588,561,[{"release":{"version":"1.0.552","releaseId":"2026.10.20.01"},"member_cache":589,"coach_cache":562},{"release":{"version":"1.0.547","releaseId":"2026.10.09.04"},"member_cache":564,"coach_cache":537}])
except RuntimeError: pass
else: raise AssertionError("release rollback accepted")
class Oversized:
    def __enter__(self): return self
    def __exit__(self,*args): return False
    def read(self,_limit): return b"x"*2_000_001
with patch.object(m.urllib.request,"urlopen",return_value=Oversized()):
    try: m.cloudflare_get(account,"synthetic-token","pages/projects/tennisnote-app-dev")
    except RuntimeError as exc: assert "size limit" in str(exc)
    else: raise AssertionError("oversized Cloudflare response accepted")
for bad_url in ("http://preview.tennisnote-app-dev.pages.dev", "https://preview.other.pages.dev", "https://user@preview.tennisnote-app-dev.pages.dev"):
    invalid=dict(good_deploy,url=bad_url)
    try: m.rollback_proof("tennisnote-app-dev",[invalid])
    except RuntimeError: pass
    else: raise AssertionError("wrong rollback origin accepted")
projects={
 "tennisnote-admin-dev":{"name":"tennisnote-admin-dev","production_branch":"dev","subdomain":"tennisnote-admin-dev.pages.dev","domains":["tennisnote-admin-dev.pages.dev"]},
 "tennisnote-app-dev":{"name":"tennisnote-app-dev","production_branch":"dev","subdomain":"tennisnote-app-dev.pages.dev","domains":["tennisnote-app-dev.pages.dev"]},
}
def fake_get(_account,_token,path):
    name=next((candidate for candidate in m.EXPECTED_PROJECTS if f"pages/projects/{candidate}" in path),None)
    if path.endswith("?env=production&per_page=1"):
        return {"success":True,"result":[dict(good_deploy,url=f"https://preview.{name}.pages.dev")]}
    return {"success":True,"result":projects.get(name)}
with patch.object(m,"cloudflare_get",side_effect=fake_get):
    assert len(m.verify_live_target(account_fp,account,"synthetic-token"))==64
for mutation in ("missing","branch","domain","production-domain","rollback"):
    saved=json.loads(json.dumps(projects));
    if mutation=="missing": projects.pop("tennisnote-app-dev")
    elif mutation=="branch": projects["tennisnote-app-dev"]["production_branch"]="main"
    elif mutation=="domain": projects["tennisnote-app-dev"]["subdomain"]="wrong.pages.dev"
    elif mutation=="production-domain": projects["tennisnote-app-dev"]["domains"].append("tennisnote-app.pages.dev")
    try:
        def bad_get(_account,_token,path):
            name=next((candidate for candidate in m.EXPECTED_PROJECTS if f"pages/projects/{candidate}" in path),None)
            if path.endswith("?env=production&per_page=1"):
                return {"success":True,"result":[] if mutation=="rollback" else [dict(good_deploy,url=f"https://preview.{name}.pages.dev")]}
            return {"success":True,"result":projects.get(name)}
        with patch.object(m,"cloudflare_get",side_effect=bad_get):
            try: m.verify_live_target(account_fp,account,"synthetic-token")
            except RuntimeError: pass
            else: raise AssertionError(f"unsafe live target accepted: {mutation}")
    finally:
        projects.clear(); projects.update(saved)
try: m.verify_live_target("0"*64,account,"synthetic-token")
except RuntimeError: pass
else: raise AssertionError("wrong account fingerprint accepted")
with tempfile.TemporaryDirectory() as temp:
    roots=[Path(temp)/"member",Path(temp)/"admin"]
    ref="synthetic-project-ref"
    fp=m.EXPECTED_DEV_PROJECT_FINGERPRINT
    release={"version":"1.0.553","releaseId":"2026.10.21.01"}
    config=("window.TENNISNOTE_CONFIG = "+json.dumps({"environment":"development","supabaseUrl":f"https://{ref}.supabase.co","projectFingerprint":fp,"supabasePublishableKey":"synthetic-only"})+";\n\nwindow.TENNIS_NOTE_PAYMENT_CONFIG = "+json.dumps({"enabled":False,"mode":"disabled","allowedMethods":[],"bankTransfer":{"enabled":False},"channels":{}})+";")
    for root in roots:
        (root/"shared").mkdir(parents=True)
        (root/"release.json").write_text(json.dumps(release),encoding="utf-8")
        (root/"shared/config.local.js").write_text(config,encoding="utf-8")
        (root/"index.html").write_text("개발계 · 실제 결제·푸시 차단",encoding="utf-8")
    with patch.object(m,"project_fingerprint",return_value=fp): m.verify_dev_artifacts(*roots)
    prod_config=config.replace('"development"','"production"')
    (roots[0]/"shared/config.local.js").write_text(prod_config,encoding="utf-8")
    try:
        with patch.object(m,"project_fingerprint",return_value=fp): m.verify_dev_artifacts(*roots)
    except RuntimeError: pass
    else: raise AssertionError("production runtime accepted by dev gate")
print("dispatch=5 negative cases; target=6 negative cases; rollback=3 negative cases; cache floors/runtime/monotonic=PASS")
`;
  const result = execFileSync(python, ["-B", "-X", "utf8", "-c", script], { encoding: "utf8" }).trim();
  assert.match(result, /dispatch=5 negative cases/);
});

test("app candidate admission includes a clean committed CI checkout", t => {
  const tempRoot = fs.realpathSync(os.tmpdir());
  const dir = fs.mkdtempSync(path.join(tempRoot, "tn-r3-committed-admission-"));
  t.after(() => {
    const resolved = fs.realpathSync(dir);
    if (path.dirname(resolved) !== tempRoot
        || !path.basename(resolved).startsWith("tn-r3-committed-admission-")) {
      throw new Error("refusing to remove unexpected R3 test directory");
    }
    fs.rmSync(resolved, { recursive: true, force: true });
  });
  const run = args => execFileSync("git", args, { cwd: dir, stdio: "ignore" });
  fs.mkdirSync(path.join(dir, "app", "admin"), { recursive: true });
  run(["init", "-b", "main"]);
  run(["config", "user.name", "Synthetic Test"]);
  run(["config", "user.email", "synthetic@example.invalid"]);
  fs.writeFileSync(path.join(dir, "app", "admin", "base.js"), "base\n");
  run(["add", "app/admin/base.js"]);
  run(["commit", "-m", "synthetic base"]);
  const base = execFileSync("git", ["rev-parse", "HEAD"], { cwd: dir, encoding: "utf8" }).trim();
  fs.writeFileSync(path.join(dir, "app", "admin", "candidate.js"), "candidate\n");
  run(["add", "app/admin/candidate.js"]);
  run(["commit", "-m", "synthetic candidate"]);
  assert.deepEqual(promotion.changedAppPaths(base, dir), ["app/admin/candidate.js"]);
  assert.equal(execFileSync("git", ["status", "--porcelain"], { cwd: dir, encoding: "utf8" }).trim(), "");
});
