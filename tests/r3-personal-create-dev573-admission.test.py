import importlib.util
import unittest
import tempfile
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('dev573_admission', ROOT / 'scripts/check_r3_dev_deployment.py')
guard = importlib.util.module_from_spec(spec)
spec.loader.exec_module(guard)


class Admission(unittest.TestCase):
    def setUp(self):
        self.sha = 'a' * 40
        self.env = {'TENNISNOTE_CANDIDATE_SHA': self.sha, 'GITHUB_SHA': self.sha,
                    'GITHUB_EVENT_NAME': 'workflow_dispatch', 'GITHUB_REPOSITORY': guard.EXPECTED_REPOSITORY,
                    'GITHUB_REF': 'refs/heads/' + guard.PERSONAL573_BRANCH, 'GITHUB_REF_TYPE': 'branch',
                    'GITHUB_WORKFLOW': guard.EXPECTED_WORKFLOW_NAME, 'GITHUB_RUN_ATTEMPT': '1',
                    'TENNISNOTE_WORKFLOW_REF': guard.EXPECTED_REPOSITORY + '/.github/workflows/deploy-cloudflare-pages-dev.yml@refs/heads/' + guard.PERSONAL573_BRANCH}

    def test_context_exact_and_negative(self):
        self.assertEqual(guard.personal573_context(self.env, self.sha), self.sha)
        for key, value in [('GITHUB_SHA', 'b' * 40), ('GITHUB_REF', 'refs/heads/dev'),
                           ('GITHUB_RUN_ATTEMPT', '2'), ('GITHUB_EVENT_NAME', 'push'),
                           ('GITHUB_REPOSITORY', 'wrong/repo'), ('TENNISNOTE_WORKFLOW_REF', 'other')]:
            with self.subTest(key=key), self.assertRaises(RuntimeError):
                guard.personal573_context({**self.env, key: value}, self.sha)

    def test_source_exact_paths_and_wrong_parent(self):
        rows = '\n'.join(('A' if p.startswith('tests/') else 'M') + '\t' + p for p in sorted(guard.PERSONAL573_PATHS))
        def fake_git(*args):
            if args == ('rev-parse', 'HEAD'): return self.sha
            if args == ('show', '-s', '--format=%P', self.sha): return guard.PERSONAL573_BASE
            if args == ('rev-parse', self.sha + '^{tree}'): return 'c' * 40
            if args[:2] == ('status', '--porcelain'): return ''
            if args == ('diff', '--cached', '--name-only'): return ''
            if args[:3] == ('diff', '--no-renames', '--name-status'): return rows
            raise AssertionError(args)
        with patch.object(guard, 'run_git', side_effect=fake_git), patch.object(guard, 'PERSONAL573_PRODUCT_PINS', {}):
            self.assertEqual(guard.personal573_source(self.sha)['version'], '1.0.573')
        def wrong_parent(*args):
            return 'b' * 40 if args == ('show', '-s', '--format=%P', self.sha) else fake_git(*args)
        with patch.object(guard, 'run_git', side_effect=wrong_parent), self.assertRaises(RuntimeError):
            guard.personal573_source(self.sha)
        def wrong_paths(*args):
            return rows + '\nM\tapp/other.js' if args[:3] == ('diff', '--no-renames', '--name-status') else fake_git(*args)
        with patch.object(guard, 'run_git', side_effect=wrong_paths), self.assertRaises(RuntimeError):
            guard.personal573_source(self.sha)

    def test_ci_virtual_merge_distinct_from_candidate(self):
        merge, tree = 'b' * 40, 'c' * 40
        pr = {'number': 123, 'state': 'open', 'mergeable': True, 'mergeable_state': 'clean', 'merge_commit_sha': merge,
              'head': {'sha': self.sha, 'ref': guard.PERSONAL573_BRANCH, 'repo': {'full_name': guard.EXPECTED_REPOSITORY}},
              'base': {'sha': guard.PERSONAL573_BASE, 'ref': guard.PERSONAL573_BASE_BRANCH, 'repo': {'full_name': guard.EXPECTED_REPOSITORY}}}
        run = {'id': 1, 'workflow_id': 329932540, 'head_sha': self.sha, 'event': 'pull_request', 'run_attempt': 1,
               'status': 'completed', 'conclusion': 'success', 'repository': {'full_name': guard.EXPECTED_REPOSITORY},
               'head_repository': {'full_name': guard.EXPECTED_REPOSITORY},
               'pull_requests': [{'number': 123, 'head': {'sha': self.sha}, 'base': {'sha': guard.PERSONAL573_BASE}}]}
        steps = [{'name': 'Verify DEV573 successor contract', 'conclusion': 'success'}, {'name': 'Verify DEV573 personal creation', 'conclusion': 'success'}]
        jobs = {'jobs': [{'conclusion': 'success', 'steps': steps}]}
        def get(path):
            if path == 'pulls/123': return pr
            if path == 'git/commits/' + self.sha: return {'sha': self.sha, 'parents': [{'sha': guard.PERSONAL573_BASE}], 'tree': {'sha': tree}}
            if path == 'git/commits/' + merge: return {'sha': merge, 'parents': [{'sha': guard.PERSONAL573_BASE}, {'sha': self.sha}], 'tree': {'sha': tree}}
            if path.startswith('actions/workflows/'): return {'workflow_runs': [run]}
            raise AssertionError(path)
        with patch.object(guard, 'status_dev_github_get', side_effect=get), patch.object(guard, 'status_dev_github_jobs', return_value=jobs):
            self.assertEqual(guard.personal573_ci(self.sha), 1)
            for key, value in [('mergeable', False), ('mergeable_state', 'dirty')]:
                old = pr[key]; pr[key] = value
                with self.subTest(key=key), self.assertRaises(RuntimeError): guard.personal573_ci(self.sha)
                pr[key] = old
            run['head_sha'] = merge
            with self.assertRaises(RuntimeError): guard.personal573_ci(self.sha)
            run['head_sha'] = self.sha
            for location, key, value in [(run['head_repository'], 'full_name', 'other/repo'),
                    (run['pull_requests'][0]['head'], 'sha', merge),
                    (run['pull_requests'][0]['base'], 'sha', merge)]:
                old = location[key]; location[key] = value
                with self.subTest(key=key), self.assertRaises(RuntimeError): guard.personal573_ci(self.sha)
                location[key] = old
            link = run['pull_requests'][0].pop('head')
            with self.assertRaises(RuntimeError): guard.personal573_ci(self.sha)
            run['pull_requests'][0]['head'] = link
            steps[0]['conclusion'] = 'skipped'
            with self.assertRaises(RuntimeError): guard.personal573_ci(self.sha)

    def test_release_workflow_test_content_tamper_rejected(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            pins = {}
            for name in ('app/release.json', '.github/workflows/tennisnote-public-ci.yml', 'tests/r3-personal-create-dev573-admission.test.py'):
                target = root / name; target.parent.mkdir(parents=True, exist_ok=True); target.write_text('reviewed\n', encoding='utf-8')
                pins[name] = guard.sha256(b'reviewed\n')
            guard.personal573_verify_pins(pins, root)
            for name in pins:
                target = root / name; target.write_text('changed\n', encoding='utf-8')
                with self.subTest(name=name), self.assertRaises(RuntimeError): guard.personal573_verify_pins(pins, root)
                target.write_text('reviewed\n', encoding='utf-8')

    def test_pr_event_requires_exact_virtual_merge_and_no_unchecked_scope(self):
        merge = 'b' * 40
        event = {'pull_request': {'head': {'sha': self.sha, 'ref': guard.PERSONAL573_BRANCH, 'repo': {'full_name': guard.EXPECTED_REPOSITORY}},
            'base': {'sha': guard.PERSONAL573_BASE, 'ref': guard.PERSONAL573_BASE_BRANCH, 'repo': {'full_name': guard.EXPECTED_REPOSITORY}}}}
        env = {'GITHUB_EVENT_NAME': 'pull_request', 'GITHUB_REPOSITORY': guard.EXPECTED_REPOSITORY, 'GITHUB_RUN_ATTEMPT': '1', 'GITHUB_SHA': merge}
        def git(*args):
            if args == ('rev-parse', 'HEAD'): return merge
            if args == ('show', '-s', '--format=%P', merge): return guard.PERSONAL573_BASE + ' ' + self.sha
            raise AssertionError(args)
        with patch.object(guard, 'run_git', side_effect=git), patch.object(guard, 'personal573_source') as source:
            self.assertEqual(guard.personal573_ci_pr(event, env), self.sha)
            source.assert_called_once_with(self.sha, merge)
            event['pull_request']['base']['sha'] = 'd' * 40
            with self.assertRaises(RuntimeError): guard.personal573_ci_pr(event, env)

    def test_mode_and_target_fail_before_remote(self):
        with self.assertRaises(RuntimeError):
            guard.personal573_dispatch(SimpleNamespace(source_only=True, live_preflight=True, branch_preflight=False))
        with self.assertRaises(RuntimeError):
            guard.personal573_target({})


if __name__ == '__main__':
    unittest.main()
