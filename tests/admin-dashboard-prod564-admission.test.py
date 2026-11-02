import importlib.util
from pathlib import Path
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("dashboard564", ROOT / "scripts/check_admin_dashboard_prod564.py")
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class Admission(unittest.TestCase):
    def setUp(self):
        self.head, self.merge = "a" * 40, "b" * 40
        self.event = {"number": 7, "pull_request": {
            "head": {"sha": self.head, "ref": guard.BRANCH, "repo": {"full_name": guard.REPO}},
            "base": {"sha": guard.BASE, "ref": "main", "repo": {"full_name": guard.REPO}},
        }}
        self.env = {"GITHUB_EVENT_NAME": "pull_request", "GITHUB_REPOSITORY": guard.REPO,
                    "GITHUB_RUN_ATTEMPT": "1", "GITHUB_WORKFLOW": "Tennis Note Public PWA CI",
                    "GITHUB_REF": "refs/pull/7/merge", "GITHUB_SHA": self.merge,
                    "GITHUB_WORKFLOW_REF": guard.REPO + "/.github/workflows/tennisnote-public-ci.yml@refs/pull/7/merge"}

    def fake_git(self, *args):
        if args[-1] == self.head: return guard.SUPPORT_BASE
        if args[-1] == guard.SUPPORT_BASE: return guard.SOURCE
        return guard.BASE + " " + self.head

    def test_exact_pr_and_wrong_branch(self):
        with patch.object(guard, "git", self.fake_git):
            self.assertEqual(guard.validate_context("ci", self.event, self.env), (self.head, self.merge))
            bad = {**self.event, "pull_request": {**self.event["pull_request"], "head": {**self.event["pull_request"]["head"], "ref": "wrong"}}}
            with self.assertRaises(RuntimeError): guard.validate_context("ci", bad, self.env)

    def test_rejects_unreviewed_support_parent(self):
        def unexpected_parent(*args):
            if args[-1] == self.head: return "f" * 40
            return self.fake_git(*args)
        with patch.object(guard, "git", unexpected_parent), self.assertRaisesRegex(RuntimeError, "DASHBOARD564_PR"):
            guard.validate_context("ci", self.event, self.env)

    def test_exact_deployment_rejects_wrong_base(self):
        env = {**self.env, "GITHUB_EVENT_NAME": "push", "GITHUB_REF": "refs/heads/main", "GITHUB_SHA": self.head,
               "GITHUB_WORKFLOW": "Deploy Tennis Note short URLs",
               "GITHUB_WORKFLOW_REF": guard.REPO + "/.github/workflows/deploy-cloudflare-pages.yml@refs/heads/main"}
        event = {"before": guard.BASE, "head_commit": {"message": guard.SUBJECT}}
        with patch.object(guard, "git", return_value=guard.BASE):
            self.assertEqual(guard.validate_context("deploy", event, env), (self.head, self.head))
            with self.assertRaises(RuntimeError): guard.validate_context("deploy", {**event, "before": "0" * 40}, env)

    def test_unknown_scope_rejected_before_product_reads(self):
        head = "a" * 40
        def fake(*args):
            if args[:2] == ("rev-parse", "HEAD"): return head
            if args[:2] == ("status", "--porcelain"): return ""
            if args[:3] == ("diff", "--cached", "--name-only"): return ""
            if args[:3] == ("show", "-s", "--format=%P"): return {guard.SOURCE: guard.FEATURE, guard.FEATURE: guard.BASE}[args[3]]
            if args[0] == "rev-parse": return "tree"
            if args == ("diff", "--name-only", guard.BASE, guard.SOURCE): return "\n".join(sorted(guard.PRODUCT))
            if args == ("diff", "--name-only", guard.BASE, head): return "\n".join(sorted(guard.PRODUCT | set(guard.SUPPORT_PINS) | {guard.SELF, "unexpected"}))
            raise AssertionError(args)
        with patch.object(guard, "git", fake), self.assertRaisesRegex(RuntimeError, "CANDIDATE_SCOPE"):
            guard.source(head, head)

    def test_self_seal_rejects_different_source(self):
        sample = b'SELF_SEAL = "PENDING"\nvalue = 1\n'
        self.assertNotEqual(guard.seal(sample), guard.seal(sample.replace(b"1", b"2")))


if __name__ == "__main__":
    unittest.main()
