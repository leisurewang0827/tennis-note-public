"""Synthetic metadata tests only; never contact a hosted service."""
import copy
import importlib.util
import pathlib
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("status_deploy", ROOT / "scripts/check_r3_dev_deployment.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class StatusDeploy(unittest.TestCase):
    def fixture(self):
        repo = module.EXPECTED_REPOSITORY
        head, merge, tree, source = "1" * 40, "2" * 40, "3" * 40, "4" * 40
        run = {"id": 123, "workflow_id": 329932540, "path": ".github/workflows/tennisnote-public-ci.yml", "event": "pull_request", "head_sha": head, "run_attempt": 1, "status": "completed", "conclusion": "success", "repository": {"full_name": repo}, "head_repository": {"full_name": repo}, "pull_requests": [{"number": 7, "head": {"sha": head}, "base": {"sha": module.STATUS_DEV_BASE}}]}
        pr = {"number": 7, "state": "open", "merge_commit_sha": merge, "head": {"sha": head, "ref": module.STATUS_DEV_BRANCH, "repo": {"full_name": repo}}, "base": {"sha": module.STATUS_DEV_BASE, "ref": module.STATUS_DEV_PARENT, "repo": {"full_name": repo}}}
        commit = {"sha": head, "parents": [{"sha": source}], "tree": {"sha": tree}}
        source_commit = {"sha": source, "parents": [{"sha": module.STATUS_DEV_BASE}]}
        merged = {"sha": merge, "parents": [{"sha": module.STATUS_DEV_BASE}, {"sha": head}], "tree": {"sha": tree}}
        jobs = {"jobs": [{"name": "build-and-check", "status": "completed", "conclusion": "success", "steps": [{"name": "Admit exact response-label successor", "status": "completed", "conclusion": "success"}]}]}
        return [run, pr, commit, source_commit, merged, jobs, head]

    def test_exact_metadata_is_not_live_or_deploy_evidence(self):
        args = self.fixture()
        self.assertEqual(module.status_dev_ci_evidence(*args)["runId"], 123)

    def test_missing_or_failed_job_wrong_pr_and_wrong_graph_hold(self):
        for which in range(5):
            args = copy.deepcopy(self.fixture())
            if which == 0: args[5]["jobs"][0]["conclusion"] = "failure"
            if which == 1: args[5]["jobs"][0]["steps"] = []
            if which == 2: args[1]["base"]["ref"] = "main"
            if which == 3: args[4]["parents"].reverse()
            if which == 4: args[0]["run_attempt"] = 2
            with self.assertRaises(RuntimeError): module.status_dev_ci_evidence(*args)

    def test_two_layer_graph_positive_and_wrong_middle_parent(self):
        args = self.fixture()
        self.assertEqual(module.status_dev_ci_evidence(*args)["source"], "4" * 40)
        for index, parent in [(3, "5" * 40), (2, module.STATUS_DEV_BASE)]:
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


if __name__ == "__main__":
    unittest.main()
