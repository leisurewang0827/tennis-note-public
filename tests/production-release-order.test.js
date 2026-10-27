"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),{spawnSync}=require("node:child_process");

test("dependency failure is sanitized before any preflight read",()=>{
  const script=String.raw`
import builtins, contextlib, io, json, runpy, sys
from pathlib import Path
from unittest.mock import patch
entry = Path.cwd() / "scripts/check_production_release_order.py"
original_import = builtins.__import__
for failure in (FileNotFoundError("synthetic_private_path"), json.JSONDecodeError("synthetic_private_content", "x", 0)):
    calls=[]
    def rejected_import(name, *args, **kwargs):
        if name == "check_r3_dev_deployment":
            calls.append(name)
            raise failure
        return original_import(name, *args, **kwargs)
    output=io.StringIO()
    with patch("builtins.__import__",side_effect=rejected_import),contextlib.redirect_stdout(output):
        try:
            runpy.run_path(str(entry),run_name="__main__")
            raise AssertionError("dependency_failure_must_stop")
        except SystemExit as stopped:
            assert stopped.code == 1
    assert calls == ["check_r3_dev_deployment"]
    assert output.getvalue() == "FAIL production_release_order dependency_unavailable\n"
print(json.dumps({"newDependencyFailureCase":"PASS","variants":2,"network":0,"db":0}))
`;
  const result=spawnSync(process.env.PYTHON||"python",["-B","-X","utf8","-c",script],{cwd:path.resolve(__dirname,".."),encoding:"utf8",timeout:20000});
  assert.equal(result.status,0,"dependency_failure_case_failed");assert.equal(result.stderr,"");
  assert.equal(JSON.parse(result.stdout).newDependencyFailureCase,"PASS");
  console.log(result.stdout.trim());
});

test("first production deploy release order: offline context, pairs and bounded reader",()=>{
  const script=String.raw`
import copy, io, json, os, ssl, sys, unittest, urllib.error, urllib.request
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, str(Path.cwd() / "scripts"))
import check_production_release_order as guard
import check_r3_dev_deployment as reader

SHA = "a" * 40
ENV = {"GITHUB_REPOSITORY":guard.REPOSITORY,"GITHUB_EVENT_NAME":"push","GITHUB_REF":"refs/heads/main",
       "GITHUB_REF_TYPE":"branch","GITHUB_WORKFLOW_REF":guard.WORKFLOW_REF,"GITHUB_WORKFLOW":guard.WORKFLOW,
       "GITHUB_RUN_ATTEMPT":"1","GITHUB_SHA":SHA}
def release(version):
    return {"version":version,"appSurfaceVersion":version,"releaseId":"2099.01.02.01","deployedAt":"2099-01-02T00:00:00+00:00"}
BUILT, DEV, PROD = release("1.0.20"), release("1.0.21"), release("1.0.19")
PROD.update(releaseId="2099.01.01.01",deployedAt="2099-01-01T00:00:00+00:00")

class GateCases(unittest.TestCase):
    def order(self, **changes):
        values={"built_member":BUILT,"built_admin":BUILT,"dev_member":DEV,"dev_admin":DEV,"prod_member":PROD,"prod_admin":PROD}
        values.update(changes);guard.validate_order(**values)
    def test_valid_main_push_and_dispatch(self):
        self.order()
        for event in ("push","workflow_dispatch"):
            self.assertEqual(guard.validate_context(dict(ENV,GITHUB_EVENT_NAME=event),SHA),SHA)
    def test_equal_and_reversed_dev_rejected(self):
        for version in ("1.0.20","1.0.19","1.0.9"):
            with self.subTest(version=version),self.assertRaisesRegex(guard.ReleaseOrderError,"development_must_be_strictly_ahead"):
                self.order(dev_member=release(version),dev_admin=release(version))
    def test_pair_mismatches_and_partial_deploy_rejected(self):
        for key in ("built_admin","dev_admin","prod_admin"):
            changed=copy.deepcopy({"built_admin":BUILT,"dev_admin":DEV,"prod_admin":PROD}[key]);changed["releaseId"]="2099.01.03.01"
            with self.subTest(pair=key),self.assertRaisesRegex(guard.ReleaseOrderError,"pair_mismatch"):
                self.order(**{key:changed})
        with self.assertRaisesRegex(guard.ReleaseOrderError,"partial_deploy"):
            self.order(prod_member=BUILT)
    def test_repeat_regression_and_invalid_metadata_rejected(self):
        for value in (BUILT,DEV):
            with self.assertRaisesRegex(guard.ReleaseOrderError,"already_deployed_or_regressed"):
                self.order(prod_member=value,prod_admin=value)
        for changes in ({"releaseId":PROD["releaseId"]},{"deployedAt":"2098-01-01T00:00:00Z"}):
            value=dict(BUILT,**changes)
            with self.assertRaisesRegex(guard.ReleaseOrderError,"metadata_not_forward"):
                self.order(built_member=value,built_admin=value)
        for changes in ({"version":"1.0.x"},{"appSurfaceVersion":"1.0.1"},{"deployedAt":"2099-01-02"}):
            with self.assertRaises(guard.ReleaseOrderError):guard.release_key(dict(BUILT,**changes))
    def test_context_before_artifact_or_network(self):
        for key,value in (("GITHUB_REF","refs/heads/dev"),("GITHUB_REF_TYPE","tag"),("GITHUB_EVENT_NAME","pull_request"),
                          ("GITHUB_REPOSITORY","synthetic/other"),("GITHUB_WORKFLOW_REF","other"),("GITHUB_WORKFLOW","other"),
                          ("GITHUB_SHA","b"*40),("GITHUB_RUN_ATTEMPT","2")):
            with self.subTest(field=key),patch.dict(os.environ,dict(ENV,**{key:value}),clear=True),patch.object(guard,"run_git",return_value=SHA),patch.object(guard,"read_release") as artifact,patch.object(guard,"_http_read") as http:
                with self.assertRaises(guard.ReleaseOrderError):guard.run_preflight()
                artifact.assert_not_called();http.assert_not_called()
    def test_actual_entry_fixed_reads_and_source_mismatch(self):
        with patch.dict(os.environ,ENV,clear=True),patch.object(guard,"run_git",return_value=SHA),patch.object(guard,"read_release",side_effect=[BUILT,BUILT,BUILT]),patch.object(guard,"_http_read",side_effect=[DEV,DEV,PROD,PROD]) as http:
            guard.run_preflight()
            self.assertEqual([call.args for call in http.call_args_list],[(role,SHA) for role in ("member_release","admin_release","production_member_release","production_admin_release")])
        with patch.dict(os.environ,ENV,clear=True),patch.object(guard,"run_git",return_value=SHA),patch.object(guard,"read_release",side_effect=[BUILT,BUILT,DEV]),patch.object(guard,"_http_read") as http:
            with self.assertRaisesRegex(guard.ReleaseOrderError,"built_source_release_mismatch"):guard.run_preflight()
            http.assert_not_called()
    def test_network_failure_and_arguments_fail_closed_without_raw_log(self):
        output=io.StringIO()
        with patch.dict(os.environ,ENV,clear=True),patch.object(guard,"run_git",return_value=SHA),patch.object(guard,"read_release",return_value=BUILT),patch.object(guard,"_http_read",side_effect=RuntimeError("synthetic_do_not_echo")) as http,patch.object(sys,"argv",["guard"]),patch("sys.stdout",output):
            self.assertEqual(guard.main(),1);self.assertEqual(http.call_count,1)
        self.assertEqual(output.getvalue(),"FAIL production_release_order evidence_unavailable\n")
        with patch.object(sys,"argv",["guard","--skip"]),patch.object(guard,"run_preflight") as run,patch("sys.stdout",io.StringIO()):
            self.assertEqual(guard.main(),1);run.assert_not_called()
    def test_actual_reader_tls_redirect_and_bounds(self):
        self.assertIsNone(reader._NoRedirectHandler().redirect_request(None,None,302,"",{},"https://example.invalid"))
        https=next(handler for handler in reader._LIVE_READ_OPENER.handlers if isinstance(handler,urllib.request.HTTPSHandler))
        tls=getattr(https,"_context",None)
        self.assertTrue(tls is None or (tls.verify_mode==ssl.CERT_REQUIRED and tls.check_hostname))
        class Response:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self,n):
                self_test.assertEqual(n,1_000_001);return b"{}"
        self_test=self
        def open_checked(request,timeout):
            self.assertEqual(timeout,15);self.assertEqual(request.get_method(),"GET")
            self.assertEqual(request.full_url,"https://tennisnote-app-dev.pages.dev/release.json?__tn_preflight="+SHA)
            self.assertEqual(request.get_header("Cache-control"),"no-cache");return Response()
        with patch.object(reader._LIVE_READ_OPENER,"open",side_effect=open_checked):
            self.assertEqual(reader._http_read("member_release",SHA),{})
        for error in (urllib.error.HTTPError("https://example.invalid",302,"",{},None),ssl.SSLCertVerificationError("synthetic_certificate_failure")):
            with patch.object(reader._LIVE_READ_OPENER,"open",side_effect=error) as opened,patch.object(reader.time,"sleep") as sleep:
                with self.assertRaises(RuntimeError):reader._http_read("member_release",SHA)
                self.assertEqual(opened.call_count,1);sleep.assert_not_called()
        with patch.object(Response,"read",return_value=b"x"*1_000_001),patch.object(reader._LIVE_READ_OPENER,"open",return_value=Response()):
            with self.assertRaisesRegex(RuntimeError,"BODY_TOO_LARGE"):reader._http_read("member_release",SHA)

result=unittest.TextTestRunner(stream=io.StringIO()).run(unittest.defaultTestLoader.loadTestsFromTestCase(GateCases))
print(json.dumps({"newOfflineCases":result.testsRun,"failures":[case.id() for case,_ in result.failures+result.errors],"passed":result.wasSuccessful(),"actualNetwork":0,"db":0}))
sys.exit(0 if result.wasSuccessful() else 1)
`;
  const result=spawnSync(process.env.PYTHON||"python",["-B","-X","utf8","-c",script],{cwd:path.resolve(__dirname,".."),encoding:"utf8",timeout:20000});
  assert.equal(result.status,0,result.stdout||"offline_python_test_failed");
  const evidence=JSON.parse(result.stdout);assert.equal(evidence.newOfflineCases,8);assert.equal(evidence.passed,true);
  const workflow=fs.readFileSync(path.join(__dirname,"../.github/workflows/deploy-cloudflare-pages.yml"),"utf8");
  const command="run: python scripts/check_production_release_order.py";
  assert.equal(workflow.split(command).length-1,1,"one_mandatory_preflight");
  const pos=workflow.indexOf(command);
  assert(pos>workflow.indexOf("run: python scripts/check_cloudflare_build.py"));
  assert(pos<workflow.indexOf("- name: Deploy member PWA")&&pos<workflow.indexOf("- name: Deploy administrator web"));
  assert(!workflow.includes("continue-on-error"));
  assert.match(workflow.slice(workflow.indexOf("- name: Require fresh"),pos),/^\- name: Require fresh[^\n]*\r?\n\s*$/);
  console.log(JSON.stringify(evidence));
});
