import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const python = process.env.TENNISNOTE_PYTHON || "python";

function runPython(body) {
  return execFileSync(python, ["-B", "-c", body], {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
  });
}

test("R3 1.0.549 successor is exactly restored before the frozen Auth parity lookup", () => {
  const output = runPython(`
import copy, hashlib, subprocess, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as a
port=a._load_r3_successor_authority()
assert port['baseCommit']=='582ebd00f31654233ecc77c1bf2efdd4fde0beec'
assert port['candidateCommit']=='3f52094ad45979ceb5a732d56aaca1445f5ecae6'
assert port['target']=='public-dev' and port['targetBranch']=='dev'
assert len(port['files'])==15
def git_text(rev,path):
    return subprocess.check_output(['git','show',rev+':'+path]).decode('utf-8').replace('\\r\\n','\\n')
for row in port['files']:
    candidate=git_text(port['candidateCommit'],row['path'])
    base=git_text(port['baseCommit'],row['path'])
    original=candidate
    restored=a.restore_r3_basic_settlement_successor_base(row['path'],candidate)
    assert restored==base, row['path']
    assert candidate==original, 'input mutated: '+row['path']
    assert a.sha256(restored.encode('utf-8'))==row['beforeSha256']
observed=[]
legacy=a.restore_auth_dev_prepare_base_legacy
a.restore_auth_dev_prepare_base_legacy=lambda path,text: (observed.append((path,text)),text)[1]
try:
    candidate=git_text(port['candidateCommit'],'app/release.json')
    result=a.restore_auth_dev_prepare_base('app/release.json',candidate)
finally:
    a.restore_auth_dev_prepare_base_legacy=legacy
assert len(observed)==1
assert observed[0][1]==git_text(port['baseCommit'],'app/release.json')
assert result==observed[0][1]
print('R3_SUCCESSOR_EXACT_RESTORE_AND_ORDER_PASS')
`);
  assert.match(output, /R3_SUCCESSOR_EXACT_RESTORE_AND_ORDER_PASS/);
});

test("R3 successor authority fails closed on scope, release, hunk, and source drift", () => {
  const output = runPython(`
import copy, subprocess, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as a
port=a._load_r3_successor_authority()
def git_text(path):
    return subprocess.check_output(['git','show',port['candidateCommit']+':'+path]).decode('utf-8').replace('\\r\\n','\\n')
def must_fail(call):
    try: call()
    except RuntimeError: return
    raise AssertionError('invalid successor authority accepted')
for field,value in [('baseCommit','0'*40),('candidateCommit','1'*40),('target','public-main'),('targetBranch','main'),('candidateReleaseId','2026.10.18.99')]:
    bad=copy.deepcopy(port); bad[field]=value
    must_fail(lambda bad=bad: a.restore_r3_basic_settlement_successor_base('app/release.json',git_text('app/release.json'),bad))
bad=copy.deepcopy(port); bad['files'].pop()
must_fail(lambda: a.restore_r3_basic_settlement_successor_base('app/release.json',git_text('app/release.json'),bad))
must_fail(lambda: a.restore_r3_basic_settlement_successor_base('app/release.json',git_text('app/release.json')+'\\n'))
for path in ('app/shared/tennisnote-runtime-environment.js','android/app/build.gradle','mobile/tennis-note-store/ios/App/App.xcodeproj/project.pbxproj'):
    value='synthetic-unmodified-content'
    assert a.restore_r3_basic_settlement_successor_base(path,value)==value
row=next(item for item in port['files'] if item['path']=='app/admin/actions/coach.js')
needle=row['hunks'][0]['candidate']
text=git_text(row['path'])
for mutated in (text.replace(needle,'',1),text+needle):
    bad=copy.deepcopy(port)
    changed=next(item for item in bad['files'] if item['path']==row['path'])
    changed['afterSha256']=a.sha256(mutated.encode('utf-8'))
    must_fail(lambda mutated=mutated,bad=bad: a.restore_r3_basic_settlement_successor_base(row['path'],mutated,bad))
release_row=next(item for item in port['files'] if item['path']=='app/release.json')
release_text=git_text(release_row['path']).replace('2026.10.19.01','2026.10.19.02',1)
bad=copy.deepcopy(port)
next(item for item in bad['files'] if item['path']==release_row['path'])['afterSha256']=a.sha256(release_text.encode('utf-8'))
must_fail(lambda: a.restore_r3_basic_settlement_successor_base(release_row['path'],release_text,bad))
print('R3_SUCCESSOR_FAIL_CLOSED_NEGATIVES_PASS')
`);
  assert.match(output, /R3_SUCCESSOR_FAIL_CLOSED_NEGATIVES_PASS/);
});

test("DEV source gate compares the frozen release baseline but returns the raw 1.0.549 candidate", () => {
  const output = runPython(`
import json, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as alignment
import check_tennisnote_development_deploy_scope as deploy_scope
path=deploy_scope.ROOT/'app/release.json'
raw=path.read_text(encoding='utf-8')
original=raw
frozen={'version':'1.0.548','releaseId':'2026.10.13.02'}
candidate=deploy_scope.validate_frozen_release_metadata(raw,frozen)
canonical=json.loads(alignment.restore_r3_basic_settlement_successor_base('app/release.json',raw))
assert canonical['version']==frozen['version'] and canonical['releaseId']==frozen['releaseId']
assert candidate=={'version':'1.0.549','releaseId':'2026.10.19.01'}
assert raw==original and path.read_text(encoding='utf-8')==original
try: deploy_scope.validate_frozen_release_metadata(raw,{'version':'1.0.547','releaseId':'2026.10.01.01'})
except deploy_scope.ScopeError as error: assert str(error)=='development_release_mismatch'
else: raise AssertionError('wrong frozen metadata accepted')
drift=raw.replace('2026.10.19.01','2026.10.19.02',1)
try: deploy_scope.validate_frozen_release_metadata(drift,frozen)
except RuntimeError: pass
else: raise AssertionError('release source drift accepted')
print('DEV_FROZEN_COMPARE_RAW_CANDIDATE_PASS')
`);
  assert.match(output, /DEV_FROZEN_COMPARE_RAW_CANDIDATE_PASS/);
});
