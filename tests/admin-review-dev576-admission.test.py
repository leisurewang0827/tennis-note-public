import importlib.util
from pathlib import Path
import types
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("review576", ROOT / "scripts/check_admin_review_dev576.py")
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class Admission(unittest.TestCase):
    def setUp(self):
        self.head = "a" * 40
        self.merge = "b" * 40
        self.event = {"number": 7, "pull_request": {
            "head": {"sha": self.head, "ref": guard.BRANCH, "repo": {"full_name": guard.REPO}},
            "base": {"sha": guard.BASE, "ref": guard.BASE_BRANCH, "repo": {"full_name": guard.REPO}},
        }}
        self.env = {"GITHUB_EVENT_NAME": "pull_request", "GITHUB_REPOSITORY": guard.REPO,
                    "GITHUB_RUN_ATTEMPT": "1", "GITHUB_WORKFLOW": "Tennis Note Public PWA CI",
                    "GITHUB_REF": "refs/pull/7/merge", "GITHUB_SHA": self.merge,
                    "GITHUB_WORKFLOW_REF": guard.REPO + "/.github/workflows/tennisnote-public-ci.yml@refs/pull/7/merge"}
        self.old = types.SimpleNamespace(run_git=lambda *args: self.merge if args[:2] == ("rev-parse", "HEAD") else guard.BASE + " " + self.head)

    def test_ci_context_is_exact(self):
        with patch.object(guard, "source", return_value={}):
            self.assertEqual(guard.ci_pr(self.event, self.env, self.old), self.head)
            with self.assertRaises(RuntimeError): guard.ci_pr(self.event, {**self.env, "GITHUB_RUN_ATTEMPT": "2"}, self.old)
            with self.assertRaises(RuntimeError): guard.ci_pr(self.event, {**self.env, "GITHUB_REF": "refs/pull/8/merge"}, self.old)
            wrong = {**self.event, "pull_request": {**self.event["pull_request"], "base": {"sha": "0" * 40, "ref": guard.BASE_BRANCH, "repo": {"full_name": guard.REPO}}}}
            with self.assertRaises(RuntimeError): guard.ci_pr(wrong, self.env, self.old)

    def test_wrong_dispatch_stops_before_ci_or_network(self):
        args = types.SimpleNamespace(source_only=True, live_preflight=False, branch_preflight=False)
        with patch.dict("os.environ", {}, clear=True), patch.object(guard, "ci_receipt") as receipt:
            with self.assertRaises(RuntimeError): guard.dispatch(args, self.old)
            receipt.assert_not_called()

    def test_self_seal_is_sensitive_to_change(self):
        sample = b'SELF_SEAL = "PENDING"\nvalue = 1\n'
        self.assertNotEqual(guard.seal(sample), guard.seal(sample.replace(b"1", b"2")))

    def test_unknown_support_path_is_rejected_before_file_reads(self):
        candidate = "c" * 40
        def git(*args):
            if args[:2] == ("rev-parse", "HEAD"): return candidate
            if args[:2] == ("status", "--porcelain"): return ""
            if args[:3] == ("diff", "--cached", "--name-only"): return ""
            if args[:3] == ("show", "-s", "--format=%P"):
                return {candidate: guard.SOURCE, guard.SOURCE: guard.COLLECTOR, guard.COLLECTOR: guard.FEATURE, guard.FEATURE: guard.BASE}[args[3]]
            if args[0] == "rev-parse": return "tree"
            if args == ("diff", "--name-only", guard.BASE, guard.SOURCE): return "\n".join(sorted(guard.PRODUCT))
            if args == ("diff", "--name-only", guard.SOURCE, candidate): return "\n".join(sorted(set(guard.SUPPORT_PINS) | {guard.SELF, "unexpected"}))
            raise AssertionError(args)
        with self.assertRaisesRegex(RuntimeError, "SUPPORT_SCOPE"):
            guard.source(candidate, candidate, types.SimpleNamespace(run_git=git))


if __name__ == "__main__":
    unittest.main()
