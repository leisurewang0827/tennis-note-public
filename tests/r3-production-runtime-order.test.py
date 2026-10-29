"""운영 게시 새 연결부만 검사. 합성 설정/메모리 HTTP, 실제 네트워크 0."""
import contextlib
import hashlib
import importlib.util
import io
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
fixture = json.loads((ROOT / "tests/fixtures/r3-production-purchase-selection.json").read_text(encoding="utf-8"))
recipe = fixture["httpHelper"]
base = subprocess.check_output(["git", "show", fixture["base"] + ":" + recipe["path"]], cwd=ROOT).decode().replace("\r\n", "\n")
assert hashlib.sha256(base.encode()).hexdigest() == recipe["baseLfSha256"]
assert base.count(recipe["before"]) == 1
selected = base.replace(recipe["before"], recipe["after"])
assert hashlib.sha256(selected.encode()).hexdigest() == recipe["selectedLfSha256"]
# checkout의 전체 DEV 후속 helper 대신 운영 base + 고정 endpoint 세 개만 실제 import.
transport = types.ModuleType("check_r3_dev_deployment")
transport.__file__ = str(ROOT / recipe["path"])
exec(compile(selected, transport.__file__, "exec"), transport.__dict__)
sys.modules[transport.__name__] = transport
import check_production_release_order as guard
import build_cloudflare_pages as builder

SHA = "1" * 40
SYNTHETIC_FP = hashlib.sha256(b"synthetic-only").hexdigest()
ENV = {"GITHUB_REPOSITORY": guard.REPOSITORY, "GITHUB_EVENT_NAME": "push", "GITHUB_REF": "refs/heads/main",
       "GITHUB_REF_TYPE": "branch", "GITHUB_WORKFLOW_REF": guard.WORKFLOW_REF, "GITHUB_WORKFLOW": guard.WORKFLOW,
       "GITHUB_RUN_ATTEMPT": "1", "GITHUB_SHA": SHA}


def release(version):
    return {"version": "1.0." + str(version), "appSurfaceVersion": "1.0." + str(version),
            "releaseId": "2026.10.29." + str(version), "deployedAt": "2026-10-29T00:00:00+09:00"}


def config(**overrides):
    data = {"environment": "production", "supabaseUrl": "https://synthetic-only.supabase.co", "projectFingerprint": SYNTHETIC_FP}
    data.update(overrides)
    return "window.TENNISNOTE_CONFIG = " + json.dumps(data) + ";\nwindow.TENNIS_NOTE_PAYMENT_CONFIG = {};\n"


class RuntimeOrderDelta(unittest.TestCase):
    def setUp(self):
        self.network = patch.object(socket.socket, "connect", side_effect=AssertionError("NETWORK_FORBIDDEN"))
        self.network.start()
        self.addCleanup(self.network.stop)

    def test_transport_exact_selection(self):
        self.assertEqual(selected.replace(recipe["after"], recipe["before"]), base)
        self.assertEqual(guard._http_read, transport._http_read)
        self.assertEqual(transport.LIVE_READ_ENDPOINTS["production_member_release"], ("https://tennisnote-app.pages.dev", "/release.json", True))
        self.assertEqual(transport.LIVE_READ_ENDPOINTS["production_admin_release"], ("https://tennisnote-admin.pages.dev", "/release.json", True))
        self.assertEqual(transport.LIVE_READ_ENDPOINTS["production_pages_release"], ("https://leisurewang0827.github.io", "/tennis-note-public/app/release.json", True))

    def test_separate_strict_contexts(self):
        pages = {**ENV, "GITHUB_WORKFLOW": guard.PAGES_WORKFLOW, "GITHUB_WORKFLOW_REF": guard.PAGES_WORKFLOW_REF}
        self.assertEqual(guard.validate_context(ENV, SHA), SHA)
        self.assertEqual(guard.validate_pages_context(pages, SHA), SHA)
        for checker, data, wrong in [(guard.validate_context, ENV, pages), (guard.validate_pages_context, pages, ENV)]:
            with self.assertRaises(guard.ReleaseOrderError): checker(wrong, SHA)
            for key, value in [("GITHUB_REPOSITORY", "other/repo"), ("GITHUB_RUN_ATTEMPT", "2"), ("GITHUB_SHA", "2"*40), ("GITHUB_REF", "refs/heads/dev"), ("GITHUB_EVENT_NAME", "pull_request")]:
                with self.assertRaises(guard.ReleaseOrderError): checker({**data, key: value}, SHA)

    def test_official_generated_config_passes_only_exact_target(self):
        self.assertEqual(guard.PRODUCTION_PROJECT_FINGERPRINT, "3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a")
        env = {"TENNISNOTE_ENVIRONMENT": "production", "TENNISNOTE_SUPABASE_URL": "https://synthetic-only.supabase.co",
               "TENNISNOTE_SUPABASE_PUBLISHABLE_KEY": "synthetic-public", "TENNISNOTE_PAYMENTS_ENABLED": "false"}
        with tempfile.TemporaryDirectory() as temp, patch.dict(os.environ, env, clear=True):
            builder.write_browser_config(Path(temp))
            path = Path(temp) / "shared/config.local.js"
            with self.assertRaisesRegex(guard.ReleaseOrderError, "runtime_project_mismatch"): guard.read_runtime(path)
            # 성공 경로만 합성 target으로 모의. 제품 상수/배포 환경의 우회 옵션은 없음.
            with patch.object(guard, "PRODUCTION_PROJECT_FINGERPRINT", SYNTHETIC_FP): guard.read_runtime(path)

    def test_runtime_fail_closed_and_no_values_in_error(self):
        variants = [config(environment="development"), config(projectFingerprint="0"*64), config(supabaseUrl="https://other.invalid"),
                    config(supabaseUrl="https://synthetic-only.supabase.co/foreign"), config()+config(), "arbitrary();", "x"*1_000_001]
        with patch.object(guard, "PRODUCTION_PROJECT_FINGERPRINT", SYNTHETIC_FP):
            guard.validate_runtime(config())
            for value in variants:
                with self.assertRaises(guard.ReleaseOrderError) as raised: guard.validate_runtime(value)
                self.assertNotIn("supabase", str(raised.exception))
                self.assertNotIn("synthetic", str(raised.exception))

    def _preflight(self, pages, bad_runtime=False):
        events = []
        env = {**ENV, **({"GITHUB_WORKFLOW": guard.PAGES_WORKFLOW, "GITHUB_WORKFLOW_REF": guard.PAGES_WORKFLOW_REF} if pages else {})}
        def runtime(path):
            events.append(("runtime", path.relative_to(guard.ROOT).as_posix()))
            guard.validate_runtime(config(environment="development" if bad_runtime else "production"))
        def read(role, sha):
            self.assertEqual(sha, SHA)
            events.append(("http", role))
            return release(558 if role.startswith("production_") else 566)
        with patch.dict(os.environ, env, clear=True), patch.object(guard, "PRODUCTION_PROJECT_FINGERPRINT", SYNTHETIC_FP), patch.object(guard, "run_git", return_value=SHA), patch.object(guard, "read_runtime", side_effect=runtime), patch.object(guard, "read_release", return_value=release(559)), patch.object(guard, "_http_read", side_effect=read):
            if bad_runtime:
                with self.assertRaisesRegex(guard.ReleaseOrderError, "runtime_environment_mismatch"): guard.run_preflight(pages)
            else: guard.run_preflight(pages)
        return events

    def test_cf_actual_preflight_built_configs_before_four_reads(self):
        events = self._preflight(False)
        self.assertEqual(events[:2], [("runtime", "dist/member/shared/config.local.js"), ("runtime", "dist/admin/shared/config.local.js")])
        self.assertEqual(events[2:], [("http", role) for role in ["member_release", "admin_release", "production_member_release", "production_admin_release"]])
        self.assertEqual(len(self._preflight(False, True)), 1)

    def test_pages_actual_preflight_config_before_three_reads_own_origin(self):
        events = self._preflight(True)
        self.assertEqual(events[0], ("runtime", "_site/app/shared/config.local.js"))
        self.assertEqual(events[1:], [("http", role) for role in ["member_release", "admin_release", "production_pages_release"]])
        self.assertEqual(len(self._preflight(True, True)), 1)

    def test_order_partial_already_deployed_and_regression_still_hold(self):
        guard.validate_order(release(559), release(559), release(566), release(566), release(558), release(558))
        for versions in [(559,559,559,559,558,558), (559,559,566,566,559,559), (559,559,566,566,559,558), (559,559,566,565,558,558), (559,558,566,566,558,558), (557,557,566,566,558,558)]:
            with self.assertRaises(guard.ReleaseOrderError): guard.validate_order(*(release(v) for v in versions))

    def test_cli_redacts_and_invalid_args_never_read(self):
        for args in [["guard", "--bypass"], ["guard", "--github-pages", "extra"]]:
            with patch.object(sys, "argv", args), patch.object(guard, "run_preflight") as run, contextlib.redirect_stdout(io.StringIO()) as out:
                self.assertEqual(guard.main(), 1)
                self.assertEqual(run.call_count, 0)
                self.assertEqual(out.getvalue(), "FAIL production_release_order arguments_not_allowed\n")
        for args, pages in [(["guard"], False), (["guard", "--github-pages"], True)]:
            with patch.object(sys, "argv", args), patch.object(guard, "run_preflight") as run, contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(guard.main(), 0)
                run.assert_called_once_with(pages=pages)


if __name__ == "__main__":
    unittest.main(verbosity=2)
