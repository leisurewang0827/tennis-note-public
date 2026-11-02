"""New 574 routing/metadata negatives only; no hosted calls."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import unittest
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
import check_r3_dispute_dev574 as guard
import check_r3_dev_deployment as old


class Admission(unittest.TestCase):
    def test_live_asset_uses_existing_safe_preflight_headers(self):
        import hashlib
        payload=b'synthetic asset\n'
        url='https://example.invalid/synthetic.js'
        class Response:
            status=200
            def __enter__(self): return self
            def __exit__(self,*_): return False
            def read(self,_): return payload
        class Opener:
            calls=0
            def open(self,request,timeout):
                self.calls+=1
                self_request={k.lower():v for k,v in request.header_items()}
                assert self_request.get('user-agent')=='TennisNote-Release-Preflight/1.0'
                assert self_request.get('cache-control')=='no-cache'
                assert self_request.get('accept')=='text/javascript'
                assert 'authorization' not in self_request and 'cookie' not in self_request
                assert timeout==20
                return Response()
        opener=Opener()
        with patch.object(guard,'LIVE_BASE',{url:hashlib.sha256(payload).hexdigest()}):
            guard.live_assets('a'*40,opener)
        self.assertEqual(opener.calls,1)
        self.assertEqual(guard.FEATURE_PARENT,'e2bdbaa11375f1bacb119be6480577ce5500826a')

    def test_diagnostic_stage_fails_closed_without_disclosing_errors(self):
        self.assertEqual(guard.FEATURE_PARENT,'e2bdbaa11375f1bacb119be6480577ce5500826a')
        source=(ROOT/'scripts/check_r3_dispute_dev574.py').read_text(encoding='utf-8')
        self.assertIn("old.run_git('show','-s','--format=%P',candidate)==FEATURE_PARENT",source)
        self.assertIn("head.get('parents',[])]==[FEATURE_PARENT]",source)
        self.assertEqual(guard.stage('CONTEXT',lambda:'ok'),'ok')
        for name in guard.STAGES:
            def failure(): raise RuntimeError('sensitive arbitrary detail')
            with self.subTest(stage=name), self.assertRaisesRegex(RuntimeError,'^DEV574_STAGE_'+name+'_HOLD$'):
                guard.stage(name,failure)
        with self.assertRaisesRegex(RuntimeError,'^DEV574_STAGE_INVALID_HOLD$'):
            guard.stage('invalid',lambda:None)
        def safe_failure(msg):
            try: guard.stage('LIVE_STATE',lambda:(_ for _ in ()).throw(RuntimeError(msg)))
            except RuntimeError as exc: return guard.safe_stage_failure(exc)
        self.assertEqual(safe_failure('DEV574_LIVE'),'DEV574_STAGE_LIVE_STATE_HOLD:DEV574_LIVE')
        self.assertEqual(safe_failure('live development release read failed endpoint=member_release reason=HTTP_STATUS status=403'),'DEV574_STAGE_LIVE_STATE_HOLD:HTTP_403')
        self.assertEqual(safe_failure('secret token URL'),'DEV574_STAGE_LIVE_STATE_HOLD')
        self.assertEqual(guard.safe_stage_failure(RuntimeError('DEV574_STAGE_LIVE_STATE_HOLD:secret')),'DEV574_PREFLIGHT_HOLD')

    def test_exact_dispatch_context_and_unknown_inputs_fail_closed(self):
        sha='a'*40
        env={'GITHUB_EVENT_NAME':'workflow_dispatch','GITHUB_REPOSITORY':guard.REPO,
             'GITHUB_REF':'refs/heads/'+guard.BRANCH,'GITHUB_REF_TYPE':'branch',
             'GITHUB_WORKFLOW':old.EXPECTED_WORKFLOW_NAME,'GITHUB_RUN_ATTEMPT':'1',
             'TENNISNOTE_WORKFLOW_REF':guard.REPO+'/.github/workflows/deploy-cloudflare-pages-dev.yml@refs/heads/'+guard.BRANCH,
             'TENNISNOTE_CANDIDATE_SHA':sha,'GITHUB_SHA':sha}
        self.assertEqual(guard.context(env,sha,old),sha)
        for key,value in [('GITHUB_REF','refs/heads/main'),('GITHUB_REPOSITORY','unknown/repo'),
                          ('GITHUB_EVENT_NAME','push'),('GITHUB_RUN_ATTEMPT','2'),
                          ('TENNISNOTE_CANDIDATE_SHA','b'*40),('GITHUB_REF_TYPE','tag')]:
            with self.subTest(key=key),self.assertRaisesRegex(RuntimeError,'DEV574_CONTEXT'):
                guard.context(env|{key:value},sha,old)

    def test_release_cache_asset_pins_and_source_parent(self):
        expected=json.loads((ROOT/'app/release.json').read_text(encoding='utf-8'))
        self.assertEqual((expected['version'],expected['releaseId']),('1.0.574','2026.11.02.01'))
        self.assertEqual(old._cache_counter((ROOT/'app/tennis-note-member-app/service-worker.js').read_text(encoding='utf-8'),'tennis-note-member-pwa-'),607)
        self.assertEqual(old._cache_counter((ROOT/'app/tennis-note-coach-app/service-worker.js').read_text(encoding='utf-8'),'tennis-note-coach-mode-'),580)
        self.assertEqual(len(guard.APP_PINS),16)
        for name,sha in guard.APP_PINS.items(): self.assertEqual(guard.digest((ROOT/name).read_bytes()),sha)
        self.assertEqual(guard.self_seal((ROOT/guard.SELF).read_bytes()),guard.SELF_SEAL)
        for name,sha in guard.AUX_PINS.items(): self.assertEqual(guard.digest((ROOT/name).read_bytes()),sha)
        self.assertEqual(subprocess.run(['git','merge-base','--is-ancestor',guard.BASE,'HEAD'],cwd=ROOT).returncode,0)

    def test_previous_deploy_guard_and_ci_exact_inverse(self):
        path='scripts/check_r3_dev_deployment.py'
        before=subprocess.check_output(['git','show',guard.BASE+':'+path],cwd=ROOT).replace(b'\r\n',b'\n')
        after=(ROOT/path).read_bytes().replace(b'\r\n',b'\n')
        add=b"    parser.add_argument('--ci-dispute574', action='store_true')\n"
        self.assertEqual(after.count(add),1);after=after.replace(add,b'',1)
        start=after.index(b'        if args.ci_dispute574:\n')
        end=after.index(b'        if args.ci_personal:\n',start)
        self.assertEqual(after[:start]+after[end:],before)
        ci='.github/workflows/tennisnote-public-ci.yml'
        before=subprocess.check_output(['git','show',guard.BASE+':'+ci],cwd=ROOT).replace(b'\r\n',b'\n')
        after=(ROOT/ci).read_bytes().replace(b'\r\n',b'\n')
        start=after.index(b'      - name: Verify DEV574 exact release contract\n')
        end=after.index(b'      - name: Admit exact reviewed display and release source\n',start)
        after=after[:start]+after[end:]
        new=b"if [ '${{ steps.personal573.outputs.scoped }}' = true ] || [ '${{ steps.dispute574.outputs.scoped }}' = true ]; then"
        original=b"if [ '${{ steps.personal573.outputs.scoped }}' = true ]; then"
        self.assertEqual(after.count(new),1)
        self.assertEqual(after.replace(new,original,1),before)

    def test_exact_source_scope_rejects_unknown_asset_and_parent(self):
        sha='a'*40
        class Fake:
            _cache_counter=staticmethod(old._cache_counter)
            extra=False
            bad_parent=False
            def run_git(self,*args):
                if args==('rev-parse','HEAD'): return sha
                if args==('show','-s','--format=%P',sha): return 'b'*40 if self.bad_parent else guard.FEATURE_PARENT
                if args[0]=='rev-parse' and args[1].endswith('^{tree}'): return 'c'*40
                if args[0]=='status' or args==('diff','--cached','--name-only'): return ''
                if args[:3]==('diff','--no-renames','--name-status'):
                    names=set(guard.APP_PINS)|set(guard.AUX_PINS)|{guard.SELF}
                    if self.extra: names.add('app/unknown.js')
                    return '\n'.join('M\t'+name for name in sorted(names))
                raise AssertionError('unexpected git access')
        fake=Fake()
        self.assertEqual(guard.source(sha,sha,fake)['version'],'1.0.574')
        fake.extra=True
        with self.assertRaisesRegex(RuntimeError,'DEV574_PATHS'): guard.source(sha,sha,fake)
        fake.extra=False;fake.bad_parent=True
        with self.assertRaisesRegex(RuntimeError,'DEV574_GRAPH'): guard.source(sha,sha,fake)

    def test_live_baseline_fixed_endpoints_and_bytes(self):
        paths=['app/shared/tennisnote-settlement-adjustment.js','app/admin/views/billing.js',
               'app/tennis-note-coach-app/views/settlement.js']
        blobs=[subprocess.check_output(['git','show',guard.BASE+':'+p],cwd=ROOT) for p in paths]
        class Response:
            status=200
            def __init__(self,data): self.data=data
            def __enter__(self): return self
            def __exit__(self,*_): return False
            def read(self,_): return self.data
        class Opener:
            calls=0
            tampered=False
            def open(self,request,timeout):
                self.assert_url=request.full_url
                i=self.calls;self.calls+=1
                return Response(b'tampered' if self.tampered else blobs[i])
        opener=Opener()
        guard.live_assets('a'*40,opener)
        self.assertEqual(opener.calls,3)
        bad=Opener();bad.tampered=True
        with self.assertRaisesRegex(RuntimeError,'DEV574_LIVE_ASSET'): guard.live_assets('a'*40,bad)
        bad=Opener()
        with self.assertRaisesRegex(RuntimeError,'DEV574_LIVE_SHA'): guard.live_assets('wrong',bad)
        self.assertEqual(bad.calls,0)


if __name__=='__main__': unittest.main()
