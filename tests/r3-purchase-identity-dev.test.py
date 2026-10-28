"""신규 DEV564 연결 검사. HTTP/DB/CLI 실행 없이 합성 환경과 spy만 사용."""
import ast
from contextlib import redirect_stdout
import hashlib
import importlib.util
import io
from pathlib import Path
import socket
import subprocess
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("purchase_dev", ROOT / "scripts/check_r3_purchase_identity_dev.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
SHA = "1" * 40
PROJECT = "synthetic-development"
SYNTHETIC_FP = hashlib.sha256(PROJECT.encode()).hexdigest()


class Guard:
    def __init__(self):
        self.calls = []

    def verify_current_live_candidate(self, contract, sha, member, admin):
        self.calls.append(("runtime", contract, sha, str(member), str(admin)))

    def verify_current_live_target(self, contract, expected_fp, account, token):
        self.calls.append(("rollback", contract))
        return "synthetic-rollback-proof"


class Successor(unittest.TestCase):
    def setUp(self):
        # 실제 project 값 없이 합성 host로 함수 경계를 검사한다. 배포 상수는 수정하지 않는다.
        self.fp = patch.object(m, "PROJECT_FP", SYNTHETIC_FP)
        self.fp.start()
        self.addCleanup(self.fp.stop)
        self.network = patch.object(socket, "create_connection", side_effect=AssertionError("NETWORK_FORBIDDEN"))
        self.network.start()
        self.addCleanup(self.network.stop)
        self.env = {
            "GITHUB_EVENT_NAME": "workflow_dispatch", "GITHUB_REF": m.REF, "GITHUB_REF_TYPE": "branch",
            "GITHUB_REPOSITORY": m.REPOSITORY, "GITHUB_RUN_ATTEMPT": "1",
            "GITHUB_WORKFLOW": "Deploy Tennis Note development sites", "GITHUB_WORKFLOW_REF": m.WORKFLOW_REF,
            "GITHUB_WORKFLOW_SHA": SHA, "GITHUB_SHA": SHA, "TENNISNOTE_CANDIDATE_SHA": SHA,
            "TENNISNOTE_WORKFLOW_REF": m.WORKFLOW_REF, "TENNISNOTE_ENVIRONMENT": "development",
            "TENNISNOTE_PAYMENTS_ENABLED": "false", "TENNISNOTE_PAYMENT_MODE": "disabled",
            "TENNISNOTE_ALLOWED_PAYMENT_METHODS": "", "TENNISNOTE_BANK_TRANSFER_ENABLED": "false",
            "TENNISNOTE_SUPABASE_URL": "https://" + PROJECT + ".supabase.co",
        }
        self.proof = {"head": SHA, "checkout": SHA, "contract": "r3-purchase-identity-source/1", "base": m.BASE,
                      "admissionRoute": "dev564-manual", "event": "workflow_dispatch", "ref": m.REF,
                      "environment": "development", "release": dict(m.RELEASE), "version": "1.0.564", "productHashes": dict(m.PRODUCTS)}
        self.proof.update(tree="5" * 40, layers={"count": 2, "sourceCommit": "3" * 40,
                          "metadataCommit": SHA, "sourceTree": "4" * 40, "metadataTree": "5" * 40})
        self.guard = Guard()
        self.reads = []
        self.assets = {}
        for p in m.PRODUCTS:
            value = (ROOT / p).read_bytes()
            self.assets[p] = value
            self.assets["dist/admin-dev/" + p.removeprefix("app/admin/")] = value
        ui = (ROOT / ("app/" + m.UI)).read_bytes()
        for p in ("app/" + m.UI, "dist/member-dev/" + m.UI, "dist/admin-dev/" + m.UI):
            self.assets[p] = ui

    def read(self, path):
        self.reads.append(path)
        return self.assets[path]

    def run_preflight(self):
        return m.preflight(self.env, self.proof, self.guard, self.read)

    def test_exact_manual_runtime_then_exact_rollback(self):
        self.assertEqual(self.run_preflight(), "synthetic-rollback-proof")
        self.assertEqual([x[0] for x in self.guard.calls], ["runtime", "rollback"])
        self.assertEqual(self.guard.calls[1][1]["floors"]["development"]["source"], m.BASE)
        self.assertEqual(len(self.reads), 9)

    def test_every_missing_environment_field_blocks_before_asset_or_http(self):
        for key in tuple(self.env):
            with self.subTest(key=key):
                value = self.env.pop(key)
                with self.assertRaises((RuntimeError, ValueError)):
                    self.run_preflight()
                self.env[key] = value
        self.assertEqual(self.reads, [])
        self.assertEqual(self.guard.calls, [])

    def test_prod_wrong_project_payment_rerun_ref_sha_block(self):
        for key, value in {"TENNISNOTE_ENVIRONMENT": "production", "TENNISNOTE_SUPABASE_URL": "https://other-synthetic.supabase.co", "TENNISNOTE_PAYMENTS_ENABLED": "true", "GITHUB_RUN_ATTEMPT": "2", "GITHUB_EVENT_NAME": "push", "GITHUB_REF": "refs/heads/dev", "TENNISNOTE_CANDIDATE_SHA": "2" * 40}.items():
            with self.subTest(key=key):
                previous = self.env[key]
                self.env[key] = value
                with self.assertRaises(RuntimeError):
                    self.run_preflight()
                self.env[key] = previous
        self.assertEqual(self.reads, [])
        self.assertEqual(self.guard.calls, [])

    def test_source_proof_missing_or_drift_blocks(self):
        for key in tuple(self.proof):
            with self.subTest(key=key):
                previous = self.proof.pop(key)
                with self.assertRaises(RuntimeError):
                    self.run_preflight()
                self.proof[key] = previous
        self.assertEqual(self.guard.calls, [])

    def test_exact_product_and_preserved_ui_required_in_both_artifacts(self):
        for path in self.assets:
            with self.subTest(path=path):
                previous = self.assets[path]
                self.assets[path] = previous + b"changed"
                with self.assertRaises(RuntimeError):
                    self.run_preflight()
                self.assets[path] = previous
        self.assertEqual(self.guard.calls, [])

    def test_runtime_failure_cannot_reach_rollback_or_retry(self):
        with patch.object(self.guard, "verify_current_live_candidate", side_effect=TimeoutError("synthetic")) as run:
            with self.assertRaises(TimeoutError):
                self.run_preflight()
        self.assertEqual(run.call_count, 1)
        self.assertEqual(self.guard.calls, [])

    def test_source_cli_timeout_is_one_attempt_and_redacted(self):
        with patch.object(m.subprocess, "check_output", side_effect=subprocess.TimeoutExpired("synthetic", 60)) as call, redirect_stdout(io.StringIO()) as output:
            self.assertEqual(m.main(), 2)
        self.assertEqual(call.call_count, 1)
        self.assertEqual(output.getvalue(), "R3_PURCHASE_IDENTITY_DEV_PREFLIGHT_HOLD\n")

    def test_inherited_runtime_is_exact_and_no_protected_dependency_import(self):
        path = ROOT / m.RUNTIME_GUARD
        text = path.read_text(encoding="utf-8")
        self.assertEqual(m.digest(text.encode()), m.RUNTIME_SHA)
        tree = ast.parse(text)
        imports = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imports.update(alias.name.split(".")[0] for alias in node.names)
            if isinstance(node, ast.ImportFrom):
                imports.add(node.module.split(".")[0])
        self.assertLessEqual(imports, {"__future__", "argparse", "errno", "hashlib", "http", "json", "os", "re", "socket", "ssl", "subprocess", "sys", "time", "urllib", "pathlib"})
        self.assertNotIn("__import__", text)
        self.assertNotIn("importlib", text)
        self.assertNotIn("production_projection", text)
        self.assertNotIn("manual_ledger_http", text)


class TwoLayer(unittest.TestCase):
    # 기존8 검사를 재실행하지 않고 새 그래프·효과 연결의 영향만 선택 실행한다.
    setUp = Successor.setUp
    read = Successor.read
    run_preflight = Successor.run_preflight

    def test_two_layer_exact_D_manual_runtime_then_pinned_rollback(self):
        self.assertEqual(m.REF, "refs/heads/codex/tennisnote-r3-registration-dev564-public-20261028")
        self.assertEqual(self.run_preflight(), "synthetic-rollback-proof")
        self.assertEqual([c[0] for c in self.guard.calls], ["runtime", "rollback"])
        self.assertEqual(self.guard.calls[1][1]["floors"]["development"]["source"], m.BASE)
        self.assertEqual(len(self.reads), 9)

    def test_two_layer_missing_changed_extra_receipt_denied_before_effect(self):
        import copy
        valid = copy.deepcopy(self.proof)
        variants = [{}, {"layers": None}, {"layers": {}}, {"tree": "6" * 40}]
        for key in valid["layers"]:
            value = copy.deepcopy(valid["layers"])
            value.pop(key)
            variants.append({"layers": value})
        for key, value in [("count", 1), ("count", True), ("sourceCommit", m.BASE),
                           ("sourceCommit", SHA), ("sourceCommit", "short"), ("metadataCommit", "3" * 40),
                           ("sourceTree", "5" * 40), ("metadataTree", "4" * 40),
                           ("sourceTree", m.BASE_TREE), ("extra", "not-allowed")]:
            layers = dict(valid["layers"], **{key: value})
            variants.append({"layers": layers})
        for patch_value in variants:
            with self.subTest(case=len(patch_value), keys=sorted(patch_value)):
                self.proof = copy.deepcopy(valid)
                if not patch_value:
                    self.proof.pop("layers")
                else:
                    self.proof.update(patch_value)
                with self.assertRaises(RuntimeError):
                    self.run_preflight()
        self.assertEqual(self.reads, [])
        self.assertEqual(self.guard.calls, [])

    def test_two_layer_wrong_ref_runtime_and_rollback_failure_no_retry(self):
        for key, value in [("GITHUB_REF", "refs/heads/codex/tennisnote-r3-display-dev563-20261028"),
                           ("GITHUB_REF", "refs/heads/dev"), ("GITHUB_REF", "refs/heads/main"),
                           ("TENNISNOTE_ENVIRONMENT", "production"), ("TENNISNOTE_PAYMENTS_ENABLED", "true"),
                           ("TENNISNOTE_BANK_TRANSFER_ENABLED", "true"), ("GITHUB_RUN_ATTEMPT", "2")]:
            previous = self.env[key]
            self.env[key] = value
            with self.assertRaises(RuntimeError):
                self.run_preflight()
            self.env[key] = previous
        self.assertEqual(self.reads, [])
        self.assertEqual(self.guard.calls, [])
        with patch.object(self.guard, "verify_current_live_target", side_effect=RuntimeError("rollback drift")) as target:
            with self.assertRaisesRegex(RuntimeError, "rollback drift"):
                self.run_preflight()
        self.assertEqual(target.call_count, 1)
        self.assertEqual([c[0] for c in self.guard.calls], ["runtime"])


class TermHistory(unittest.TestCase):
    read = Successor.read

    def setUp(self):
        Successor.setUp(self)
        self.proof.update(contract="r3-term-history-source/1", base=m.TERM_BASE,
                          admissionRoute="dev565-manual", release=dict(m.TERM_RELEASE),
                          version=m.TERM_RELEASE["version"], productHashes=dict(m.TERM_PRODUCTS))
        for path in m.TERM_PRODUCTS:
            value = (ROOT / path).read_bytes()
            self.assets[path] = value
            self.assets["dist/admin-dev/" + path.removeprefix("app/admin/")] = value

    def run_preflight(self):
        return m.preflight(self.env, self.proof, self.guard, self.read, True)

    def test_new_exact_five_products_two_artifacts_then_runtime_and_rollback(self):
        self.assertEqual(self.run_preflight(), "synthetic-rollback-proof")
        self.assertEqual(len(self.reads), 13)
        self.assertEqual([c[0] for c in self.guard.calls], ["runtime", "rollback"])
        contract = self.guard.calls[0][1]
        self.assertEqual(contract["release"], m.TERM_RELEASE)
        self.assertEqual(contract["successorBase"], m.TERM_BASE)
        self.assertEqual(contract["floors"]["development"]["source"], m.TERM_BASE)

    def test_each_new_asset_or_receipt_drift_denied_before_effect(self):
        import copy
        for path in self.assets:
            value = self.assets[path]
            self.assets[path] += b"drift"
            with self.assertRaises(RuntimeError):
                self.run_preflight()
            self.assets[path] = value
        baseline = copy.deepcopy(self.proof)
        for key in baseline:
            self.proof = copy.deepcopy(baseline)
            self.proof.pop(key)
            with self.assertRaises(RuntimeError):
                self.run_preflight()
        self.assertEqual(self.guard.calls, [])

    def test_old_receipt_unknown_mode_wrong_context_and_timeout_never_retry(self):
        for key, value in [("base", m.BASE), ("release", m.RELEASE), ("admissionRoute", "dev564-manual")]:
            old = self.proof[key]
            self.proof[key] = value
            with self.assertRaises(RuntimeError):
                self.run_preflight()
            self.proof[key] = old
        for key, value in [("TENNISNOTE_ENVIRONMENT", "production"), ("TENNISNOTE_PAYMENTS_ENABLED", "true"), ("GITHUB_RUN_ATTEMPT", "2"), ("GITHUB_REF", "refs/heads/dev")]:
            old = self.env[key]
            self.env[key] = value
            with self.assertRaises(RuntimeError):
                self.run_preflight()
            self.env[key] = old
        self.assertEqual(self.reads, [])
        with patch.object(m.subprocess, "check_output", side_effect=AssertionError("CLI_FORBIDDEN")) as cli, redirect_stdout(io.StringIO()):
            self.assertEqual(m.main(["--unknown"]), 2)
            self.assertEqual(cli.call_count, 0)
        with patch.object(m.subprocess, "check_output", side_effect=subprocess.TimeoutExpired("synthetic", 60)) as cli, redirect_stdout(io.StringIO()) as output:
            self.assertEqual(m.main(["--term-history"]), 2)
            self.assertEqual(cli.call_count, 1)
            self.assertEqual(cli.call_args.args[0], ["node", m.SOURCE, "--dev-source", "--term-history"])
            self.assertEqual(output.getvalue(), "R3_PURCHASE_IDENTITY_DEV_PREFLIGHT_HOLD\n")

    def test_runtime_fail_blocks_target_without_retry(self):
        with patch.object(self.guard, "verify_current_live_candidate", side_effect=TimeoutError("synthetic")) as call:
            with self.assertRaises(TimeoutError):
                self.run_preflight()
        self.assertEqual(call.call_count, 1)
        self.assertEqual(self.guard.calls, [])


if __name__ == "__main__":
    unittest.main(verbosity=2)
