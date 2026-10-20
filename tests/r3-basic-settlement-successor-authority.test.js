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

test("R3 1.0.550 inverse, actual two-commit binding, and pending denial are exact", () => {
  const output = runPython(`
import copy, hashlib, json, pathlib, subprocess, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as a
port=json.loads(a.R3_POLICY_550_AUTHORITY_PATH.read_text(encoding='utf-8'))
assert port['bindingStatus']=='BOUND_TO_EXACT_TWO_COMMIT_STACK'
assert port['candidateCommit']=='516965ca919dadeb1294d14b44ff136e07406a83'
assert a._load_r3_policy_550_authority(port)['candidateCommit']==port['candidateCommit']
pending=copy.deepcopy(port)
pending['bindingStatus']='PENDING_EXACT_TWO_COMMIT_STACK'
pending['candidateCommit']=None
try: a._load_r3_policy_550_authority(pending)
except RuntimeError as error: assert str(error)=='R3 550 candidate commit binding pending'
else: raise AssertionError('pending candidate authority was accepted')
assert len(port['files'])==15
for row in port['files']:
    candidate=pathlib.Path(row['path']).read_text(encoding='utf-8').replace('\\r\\n','\\n')
    original=candidate
    restored=a._restore_r3_policy_550_content(row['path'],candidate,port)
    base=subprocess.check_output(['git','show',port['baseCommit']+':'+row['path']]).decode('utf-8').replace('\\r\\n','\\n')
    assert restored==base, row['path']
    assert candidate==original, 'input mutated: '+row['path']
    assert hashlib.sha256(restored.encode('utf-8')).hexdigest()==row['beforeSha256']
    if row['path'] in a.R3_SUCCESSOR_EXPECTED_PATHS:
        prior=a.restore_r3_basic_settlement_successor_base(row['path'],restored)
        old_row=next(item for item in a._load_r3_successor_authority()['files'] if item['path']==row['path'])
        assert hashlib.sha256(prior.encode('utf-8')).hexdigest()==old_row['beforeSha256'], row['path']
restored_550=a.restore_r3_coach_schedule_policy_successor_base('app/release.json',pathlib.Path('app/release.json').read_text(encoding='utf-8'))
restored_release=json.loads(restored_550)
assert restored_release['version']=='1.0.549' and restored_release['releaseId']=='2026.10.19.01'
row=port['files'][0]
candidate=pathlib.Path(row['path']).read_text(encoding='utf-8').replace('\\r\\n','\\n')+'\\n'
try: a._restore_r3_policy_550_content(row['path'],candidate,port)
except RuntimeError: pass
else: raise AssertionError('candidate content drift accepted')
feature='b'*40; release='a'*40
product=a.R3_POLICY_550_FEATURE_PATHS; release_paths=a.R3_POLICY_550_RELEASE_PATHS
original=a.run_git
def fake_run_git(*args, text=True):
    if args[:2]==('rev-list','--parents'):
        revision=args[-1]
        result=(f"{release} {feature}" if revision==release else f"{feature} {port['baseCommit']}" if revision==feature else '')
    elif args[0]=='diff-tree':
        revision=args[-1]
        result='\\n'.join(sorted(product if revision==feature else release_paths if revision==release else []))
    elif args[0]=='diff' and '--name-only' in args:
        result='\\n'.join(sorted(a.R3_POLICY_550_EXPECTED_PATHS))
    elif args[0]=='show':
        revision,path=args[1].split(':',1)
        if revision==port['baseCommit']:
            result=original(*args,text=False)
        elif revision==feature and path not in product:
            result=original('show',f"{port['baseCommit']}:{path}",text=False)
        else:
            result=pathlib.Path(path).read_bytes()
    else:
        return original(*args,text=text)
    return result if text else result.encode('utf-8') if isinstance(result,str) else result
bound=copy.deepcopy(port)
bound['candidateCommit']=release
bound['bindingStatus']='BOUND_TO_EXACT_TWO_COMMIT_STACK'
a.run_git=fake_run_git
try:
    assert a._load_r3_policy_550_authority(bound)['candidateCommit']==release
    bad=copy.deepcopy(bound); bad['bindingStatus']='BOUND_TO_EXACT_FEATURE_COMMIT'
    try: a._load_r3_policy_550_authority(bad)
    except RuntimeError: pass
    else: raise AssertionError('old one-commit binding label accepted')
    def invalid_stack(*args, text=True):
        if args[0]=='diff-tree' and args[-1]==release:
            result='\\n'.join(sorted(release_paths | {'README.md'}))
            return result if text else result.encode('utf-8')
        return fake_run_git(*args,text=text)
    a.run_git=invalid_stack
    try: a._load_r3_policy_550_authority(bound)
    except RuntimeError as error: assert str(error)=='R3 550 release commit path set mismatch'
    else: raise AssertionError('release commit with an extra path accepted')
finally: a.run_git=original
print('R3_550_CONTENT_INVERSE_PASS; TWO_COMMIT_CONTRACT_PASS; UNBOUND_FAIL_CLOSED')
`);
  assert.match(output, /R3_550_CONTENT_INVERSE_PASS; TWO_COMMIT_CONTRACT_PASS; UNBOUND_FAIL_CLOSED/);
});

test("DEV source gate accepts only the exact bound 1.0.550 release candidate", () => {
  const output = runPython(`
import json, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as alignment
import check_tennisnote_development_deploy_scope as deploy_scope
path=deploy_scope.ROOT/'app/release.json'
raw=path.read_text(encoding='utf-8')
original=raw
frozen={'version':'1.0.548','releaseId':'2026.10.13.02'}
assert json.loads(raw)['version']=='1.0.550'
try: deploy_scope.validate_frozen_release_metadata(raw,frozen)
except RuntimeError as error: raise AssertionError('exact bound 1.0.550 candidate was rejected: '+str(error))
else: assert json.loads(raw)['releaseId']=='2026.10.20.01'
assert raw==original and path.read_text(encoding='utf-8')==original
print('DEV_550_UNBOUND_RELEASE_FAIL_CLOSED_PASS')
`);
  assert.match(output, /DEV_550_UNBOUND_RELEASE_FAIL_CLOSED_PASS/);
});
