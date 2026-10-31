"""Synthetic metadata tests only; never contact a hosted service."""
import copy
import importlib.util
import pathlib
import unittest
import urllib.error
from unittest import mock

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("status_deploy", ROOT / "scripts/check_r3_dev_deployment.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StatusDeploy(unittest.TestCase):
    def test_phone_dispatch_rejects_wrong_context_before_external_access(self):
        args = type("Args", (), {"source_only": True, "live_preflight": False, "branch_preflight": False})()
        with mock.patch.dict(module.os.environ, {"GITHUB_EVENT_NAME": "push"}, clear=True), \
             mock.patch.object(module, "phone_dev_source") as source, \
             mock.patch.object(module, "phone_dev_ci") as ci:
            with self.assertRaisesRegex(RuntimeError, "PHONE_CONTEXT"):
                module.phone_dev_dispatch(args)
            source.assert_not_called()
            ci.assert_not_called()

    def test_phone_successor_scope(self):
        old = self.fixture()
        run, pr, head, merge, jobs, candidate = old[0], old[1], old[2], old[6], old[7], old[8]
        run["pull_requests"][0]["number"] = 228
        pr["number"] = 228
        head["parents"] = [{"sha": module.PHONE_DEV_PREDECESSOR}]
        prior = copy.deepcopy(run)
        prior.update({"id": module.PHONE_DEV_PREDECESSOR_RUN, "head_sha": module.PHONE_DEV_PREDECESSOR})
        prior["pull_requests"][0]["head"]["sha"] = module.PHONE_DEV_PREDECESSOR
        args = [run, pr, head, merge, jobs, prior, copy.deepcopy(jobs), candidate]
        self.assertEqual(module.phone_dev_ci_evidence(*args)["runId"], 123)
        for index, field, value in [(0, "run_attempt", 2), (1, "number", 229),
                                    (5, "head_sha", candidate), (5, "conclusion", "failure")]:
            changed = copy.deepcopy(args)
            changed[index][field] = value
            with self.assertRaises(RuntimeError): module.phone_dev_ci_evidence(*changed)
        changed = copy.deepcopy(args)
        changed[6]["jobs"][0]["steps"] = []
        with self.assertRaises(RuntimeError): module.phone_dev_ci_evidence(*changed)

    def fixture(self):
        repo = module.EXPECTED_REPOSITORY
        head, merge, tree, source = "1" * 40, "2" * 40, "3" * 40, module.STATUS_DEV_SOURCE
        run = {"id": 123, "workflow_id": 329932540, "path": ".github/workflows/tennisnote-public-ci.yml", "event": "pull_request", "head_sha": head, "run_attempt": 1, "status": "completed", "conclusion": "success", "repository": {"full_name": repo}, "head_repository": {"full_name": repo}, "pull_requests": [{"number": 7, "head": {"sha": head}, "base": {"sha": module.STATUS_DEV_BASE}}]}
        pr = {"number": 7, "state": "open", "merge_commit_sha": merge, "head": {"sha": head, "ref": module.STATUS_DEV_BRANCH, "repo": {"full_name": repo}}, "base": {"sha": module.STATUS_DEV_BASE, "ref": module.STATUS_DEV_PARENT, "repo": {"full_name": repo}}}
        commit = {"sha": head, "parents": [{"sha": module.STATUS_DEV_CORRECTIVE}], "tree": {"sha": tree}}
        corrective = {"sha": module.STATUS_DEV_CORRECTIVE, "parents": [{"sha": module.STATUS_DEV_METADATA}]}
        metadata_commit = {"sha": module.STATUS_DEV_METADATA, "parents": [{"sha": source}]}
        source_commit = {"sha": source, "parents": [{"sha": module.STATUS_DEV_BASE}]}
        merged = {"sha": merge, "parents": [{"sha": module.STATUS_DEV_BASE}, {"sha": head}], "tree": {"sha": tree}}
        jobs = {"jobs": [{"name": "build-and-check", "status": "completed", "conclusion": "success", "steps": [{"name": "Admit exact response-label successor", "status": "completed", "conclusion": "success"}]}]}
        return [run, pr, commit, corrective, metadata_commit, source_commit, merged, jobs, head]

    def test_exact_metadata_is_not_live_or_deploy_evidence(self):
        args = self.fixture()
        self.assertEqual(module.status_dev_ci_evidence(*args)["runId"], 123)

    def test_missing_or_failed_job_wrong_pr_and_wrong_graph_hold(self):
        for which in range(5):
            args = copy.deepcopy(self.fixture())
            if which == 0: args[7]["jobs"][0]["conclusion"] = "failure"
            if which == 1: args[7]["jobs"][0]["steps"] = []
            if which == 2: args[1]["base"]["ref"] = "main"
            if which == 3: args[6]["parents"].reverse()
            if which == 4: args[0]["run_attempt"] = 2
            with self.assertRaises(RuntimeError): module.status_dev_ci_evidence(*args)

    def test_corrective_layer_graph_positive_and_wrong_middle_parent(self):
        args = self.fixture()
        self.assertEqual(module.status_dev_ci_evidence(*args)["source"], module.STATUS_DEV_SOURCE)
        for index, parent in [(5, "5" * 40), (4, module.STATUS_DEV_BASE), (3, module.STATUS_DEV_SOURCE), (2, module.STATUS_DEV_METADATA)]:
            wrong = copy.deepcopy(args)
            wrong[index]["parents"] = [{"sha": parent}]
            with self.assertRaises(RuntimeError): module.status_dev_ci_evidence(*wrong)

    def test_missing_run_or_invalid_candidate_fails_closed(self):
        args = self.fixture()
        args[0] = None
        with self.assertRaises(RuntimeError): module.status_dev_ci_evidence(*args)
        args = self.fixture()
        args[-1] = "not-a-sha"
        with self.assertRaises(RuntimeError): module.status_dev_ci_evidence(*args)

    def test_authenticated_fixed_github_path_and_no_fallback(self):
        class Response:
            status = 200
            def __enter__(self): return self
            def __exit__(self, *_): pass
            def read(self, _): return b'{"ok":true}'
        class Opener:
            calls = 0
            def open(self, req, timeout):
                self.calls += 1
                self.assertions = (req.get_header("Authorization"), timeout, req.full_url)
                return Response()
        opener = Opener()
        self.assertEqual(module.status_dev_github_get("pulls/7", token="synthetic", opener=opener), {"ok": True})
        self.assertEqual(opener.calls, 1)
        self.assertEqual(opener.assertions[0], "Bearer synthetic")
        self.assertTrue(opener.assertions[2].startswith(module.ROW_SCOPE_API))
        with self.assertRaisesRegex(RuntimeError, "STATUS_GITHUB_PATH"):
            module.status_dev_github_get("https://example.invalid", token="synthetic", opener=opener)
        with self.assertRaisesRegex(RuntimeError, "STATUS_GITHUB_AUTH"):
            module.status_dev_github_get("pulls/7", token="", opener=opener)
        self.assertEqual(opener.calls, 1)

    def test_authenticated_http_errors_are_role_coded_and_redacted(self):
        class Opener:
            def __init__(self, remaining): self.remaining = remaining; self.calls = 0
            def open(self, req, timeout):
                self.calls += 1
                raise urllib.error.HTTPError(req.full_url, 403, "synthetic private", {"X-RateLimit-Remaining": self.remaining}, None)
        for remaining, expected in [("0", "STATUS_GITHUB_PR_RATE_LIMIT"), ("5", "STATUS_GITHUB_PR_HTTP_403")]:
            opener = Opener(remaining)
            with self.assertRaisesRegex(RuntimeError, expected) as caught:
                module.status_dev_github_get("pulls/7", token="synthetic-token", opener=opener)
            self.assertEqual(opener.calls, 1)
            self.assertNotIn("synthetic", str(caught.exception))

    def test_auth_fourth_layer_graph(self):
        args = self.fixture()
        self.assertEqual(module.status_dev_ci_evidence(*args)["source"], module.STATUS_DEV_SOURCE)
        for index, parent in [(2, module.STATUS_DEV_METADATA), (3, module.STATUS_DEV_SOURCE), (4, module.STATUS_DEV_BASE)]:
            wrong = copy.deepcopy(args); wrong[index]["parents"] = [{"sha": parent}]
            with self.assertRaises(RuntimeError): module.status_dev_ci_evidence(*wrong)


if __name__ == "__main__":
    unittest.main()
