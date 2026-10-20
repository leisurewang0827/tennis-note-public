import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
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
    candidate=subprocess.check_output(['git','show',port['candidateCommit']+':'+row['path']]).decode('utf-8').replace('\\r\\n','\\n')
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
release_candidate=subprocess.check_output(['git','show',port['candidateCommit']+':app/release.json']).decode('utf-8')
restored_550=a.restore_r3_coach_schedule_policy_successor_base('app/release.json',release_candidate)
restored_release=json.loads(restored_550)
assert restored_release['version']=='1.0.549' and restored_release['releaseId']=='2026.10.19.01'
row=port['files'][0]
candidate=subprocess.check_output(['git','show',port['candidateCommit']+':'+row['path']]).decode('utf-8').replace('\\r\\n','\\n')+'\\n'
try: a._restore_r3_policy_550_content(row['path'],candidate,port)
except RuntimeError: pass
else: raise AssertionError('candidate content drift accepted')
feature='b'*40; release='a'*40
actual_feature=subprocess.check_output(['git','rev-parse',port['candidateCommit']+'^']).decode().strip()
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
        elif revision==feature:
            result=original('show',f"{actual_feature}:{path}",text=False)
        elif revision==release:
            result=original('show',f"{port['candidateCommit']}:{path}",text=False)
        else:
            result=original(*args,text=False)
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
import json, subprocess, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as alignment
import check_tennisnote_development_deploy_scope as deploy_scope
path=deploy_scope.ROOT/'app/release.json'
raw=subprocess.check_output(['git','show',alignment.R3_POLICY_551_BASE_SHA+':app/release.json']).decode('utf-8')
original=raw
frozen={'version':'1.0.548','releaseId':'2026.10.13.02'}
assert json.loads(raw)['version']=='1.0.550'
try: deploy_scope.validate_frozen_release_metadata(raw,frozen)
except RuntimeError as error: raise AssertionError('exact bound 1.0.550 candidate was rejected: '+str(error))
else: assert json.loads(raw)['releaseId']=='2026.10.20.01'
assert raw==original
print('DEV_550_UNBOUND_RELEASE_FAIL_CLOSED_PASS')
`);
  assert.match(output, /DEV_550_UNBOUND_RELEASE_FAIL_CLOSED_PASS/);
});

const r3Policy551AuthorityPath = path.join(
  root,
  "tests",
  "fixtures",
  "r3-coach-settlement-input-551-successor-authority.json",
);
const r3Policy551Authority = JSON.parse(readFileSync(r3Policy551AuthorityPath, "utf8"));

test("R3 1.0.551 accepts the actual bound exact two-commit candidate", {
  skip: r3Policy551Authority.bindingStatus !== "BOUND_TO_EXACT_TWO_COMMIT_STACK",
}, () => {
  const output = runPython(`
import hashlib, json, subprocess, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as a
port=json.loads(a.R3_POLICY_551_AUTHORITY_PATH.read_text(encoding='utf-8'))
loaded=a._load_r3_policy_551_authority(port)
assert loaded['bindingStatus']=='BOUND_TO_EXACT_TWO_COMMIT_STACK'
assert loaded['candidateCommit']==port['candidateCommit']
assert len(port['commitStack']['featurePaths'])==2
assert len(port['commitStack']['releasePaths'])==13
assert len(port['files'])==len(a.R3_POLICY_551_EXPECTED_PATHS)
def git_text(revision,path):
    return subprocess.check_output(['git','show',revision+':'+path]).decode('utf-8').replace('\\r\\n','\\n')
for row in port['files']:
    candidate=git_text(port['candidateCommit'],row['path'])
    restored=a._restore_r3_policy_551_content(row['path'],candidate,port)
    base=git_text(port['baseCommit'],row['path'])
    assert restored==base, row['path']
    assert hashlib.sha256(restored.encode('utf-8')).hexdigest()==row['beforeSha256']
print('R3_551_ACTUAL_BOUND_TWO_COMMIT_ACCEPTANCE_PASS')
`);
  assert.match(output, /R3_551_ACTUAL_BOUND_TWO_COMMIT_ACCEPTANCE_PASS/);
});

test("R3 1.0.551 cloned pending authority is denied by the deploy gate", () => {
  const output = runPython(`
import copy, json, pathlib, sys, tempfile
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as a
port=json.loads(a.R3_POLICY_551_AUTHORITY_PATH.read_text(encoding='utf-8'))
pending=copy.deepcopy(port)
pending['bindingStatus']='PENDING_EXACT_TWO_COMMIT_STACK'
pending['candidateCommit']=None
try: a._load_r3_policy_551_authority(pending)
except RuntimeError as error: assert str(error)=='R3 551 candidate commit binding pending'
else: raise AssertionError('cloned pending candidate authority was accepted')
original_path=a.R3_POLICY_551_AUTHORITY_PATH
with tempfile.TemporaryDirectory(prefix='tn-r3-551-pending-') as directory:
    pending_path=pathlib.Path(directory)/'authority.json'
    pending_path.write_text(json.dumps(pending),encoding='utf-8')
    a.R3_POLICY_551_AUTHORITY_PATH=pending_path
    try:
        current=pathlib.Path('app/release.json').read_text(encoding='utf-8')
        try: a.restore_r3_basic_settlement_successor_base('app/release.json',current)
        except RuntimeError as error: assert str(error)=='R3 551 candidate commit binding pending'
        else: raise AssertionError('deploy gate accepted cloned pending authority')
    finally: a.R3_POLICY_551_AUTHORITY_PATH=original_path
print('R3_551_CLONED_PENDING_DENIAL_PASS')
`);
  assert.match(output, /R3_551_CLONED_PENDING_DENIAL_PASS/);
});

test("R3 1.0.551 content-hash drift is denied independently", () => {
  const output = runPython(`
import copy, json, pathlib, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as a
port=json.loads(a.R3_POLICY_551_AUTHORITY_PATH.read_text(encoding='utf-8'))
assert a._validate_r3_policy_551_content_authority(port) is port
assert len(port['files'])==len(a.R3_POLICY_551_EXPECTED_PATHS)
row=port['files'][0]
candidate=pathlib.Path(row['path']).read_text(encoding='utf-8').replace('\\r\\n','\\n')
bad=copy.deepcopy(port)
bad['files'][0]['afterSha256']='0'*64
try: a._restore_r3_policy_551_content(row['path'],candidate,bad)
except RuntimeError as error: assert str(error).startswith('R3 551 successor candidate content drift:')
else: raise AssertionError('551 content drift accepted')
print('R3_551_HASH_DRIFT_DENIAL_PASS')
`);
  assert.match(output, /R3_551_HASH_DRIFT_DENIAL_PASS/);
});

const r3Policy552AuthorityPath = path.join(
  root,
  "tests",
  "fixtures",
  "r3-coach-settlement-input-552-successor-authority.json",
);
const r3Policy552Authority = JSON.parse(readFileSync(r3Policy552AuthorityPath, "utf8"));

test("R3 1.0.552 binds the exact feature/release stack and restores only its approved content", () => {
  const output = runPython(`
import copy, hashlib, json, subprocess, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as a
port=json.loads(a.R3_POLICY_552_AUTHORITY_PATH.read_text(encoding='utf-8'))
loaded=a._load_r3_policy_552_authority(port)
assert loaded['candidateCommit']=='c2d966a85f88644487c2ee3de40bb48737e4c664'
assert len(port['commitStack']['featurePaths'])==2
assert len(port['commitStack']['releasePaths'])==13
assert len(port['files'])==14
def git_text(revision,path):
    return subprocess.check_output(['git','show',revision+':'+path]).decode('utf-8').replace('\\r\\n','\\n')
feature=subprocess.check_output(['git','rev-parse',port['candidateCommit']+'^']).decode().strip()
test_path=port['commitStack']['featureTestPath']
assert hashlib.sha256(git_text(feature,test_path).encode()).hexdigest()==port['commitStack']['featureTestSha256']
for row in port['files']:
    candidate=git_text(port['candidateCommit'],row['path'])
    original=candidate
    restored=a._restore_r3_policy_552_content(row['path'],candidate,port)
    base=git_text(port['baseCommit'],row['path'])
    assert restored==base, row['path']
    assert candidate==original, 'input mutated: '+row['path']
    assert hashlib.sha256(restored.encode()).hexdigest()==row['beforeSha256']
pending=copy.deepcopy(port)
pending['bindingStatus']='PENDING_EXACT_TWO_COMMIT_STACK'
pending['candidateCommit']=None
try: a._load_r3_policy_552_authority(pending)
except RuntimeError as error: assert str(error)=='R3 552 candidate commit binding pending'
else: raise AssertionError('pending 552 candidate was accepted')
bad=copy.deepcopy(port); bad['target']='public-main'
try: a._validate_r3_policy_552_content_authority(bad)
except RuntimeError as error: assert str(error)=='R3 552 successor authority context mismatch'
else: raise AssertionError('wrong target was accepted')
row=port['files'][1]
candidate=git_text(port['candidateCommit'],row['path'])
for mutated in (candidate+'\\n', candidate.replace('1.0.552','1.0.553',1)):
    try: a._restore_r3_policy_552_content(row['path'],mutated,port)
    except RuntimeError: pass
    else: raise AssertionError('552 body/hash drift was accepted')
original_run_git=a.run_git
feature=subprocess.check_output(['git','rev-parse',port['candidateCommit']+'^']).decode().strip()
def wrong_parent(*args, text=True):
    if args[:3]==('rev-list','--parents','-n') and args[-1]==feature:
        result=feature+' '+'0'*40
        return result if text else result.encode()
    return original_run_git(*args,text=text)
a.run_git=wrong_parent
try:
    try: a._load_r3_policy_552_authority(port)
    except RuntimeError as error: assert str(error)=='R3 552 commit parent mismatch'
    else: raise AssertionError('wrong parent binding was accepted')
finally:
    a.run_git=original_run_git
bad=copy.deepcopy(port); bad['commitStack']['releasePaths'].append('README.md')
try: a._validate_r3_policy_552_content_authority(bad)
except RuntimeError as error: assert str(error)=='R3 552 successor authority context mismatch'
else: raise AssertionError('unexpected path was accepted')
original_legacy=a.restore_auth_dev_prepare_base_legacy
legacy_calls=[]
def capture_legacy(path,text):
    legacy_calls.append((path,text))
    return text
a.restore_auth_dev_prepare_base_legacy=capture_legacy
try:
    a.restore_auth_dev_prepare_base('app/release.json',git_text(port['candidateCommit'],'app/release.json'))
finally:
    a.restore_auth_dev_prepare_base_legacy=original_legacy
assert len(legacy_calls)==1 and legacy_calls[0][0]=='app/release.json'
print('R3_552_EXACT_STACK_AND_CONTENT_INVERSE_PASS; PENDING_AND_BODY_HASH_TARGET_PARENT_DRIFT_DENIAL_PASS; AUTH_GOLDEN_ENTRY_LINK_PASS')
`);
  assert.match(output, /R3_552_EXACT_STACK_AND_CONTENT_INVERSE_PASS; PENDING_AND_BODY_HASH_TARGET_PARENT_DRIFT_DENIAL_PASS; AUTH_GOLDEN_ENTRY_LINK_PASS/);
});

test("R3 552 memoizes only bounded immutable full-SHA reads and keeps mutable drift live", () => {
  const output = runPython(`
import copy, hashlib, json, subprocess, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as a
port=json.loads(a.R3_POLICY_552_AUTHORITY_PATH.read_text(encoding='utf-8'))
original_run=a.subprocess.run
calls=[]
def counted(cmd,*args,**kwargs):
    if isinstance(cmd,list) and cmd and cmd[0]=='git': calls.append(tuple(cmd[1:]))
    return original_run(cmd,*args,**kwargs)
a._GIT_READ_CACHE.clear(); a._GIT_READ_CACHE_BYTES=0
a.subprocess.run=counted
try:
    first=a._load_r3_policy_552_authority()
    first_count=len(calls); first_unique=len(set(calls))
    second=a._load_r3_policy_552_authority()
    second_count=len(calls)-first_count
    assert first==second and first_count==48 and first_unique==48
    assert second_count==0, ('immutable reads repeated', second_count)
    assert len(a._GIT_READ_CACHE)<=a._GIT_READ_CACHE_MAX_ENTRIES
    assert a._GIT_READ_CACHE_BYTES<=a._GIT_READ_CACHE_MAX_BYTES
    sample=('show',port['baseCommit']+':app/release.json')
    key_text=a._immutable_git_read_key(sample,True)
    key_bytes=a._immutable_git_read_key(sample,False)
    assert key_text!=key_bytes and key_text[0]==str(a.ROOT.resolve())
    original_root=a.ROOT
    try:
        a.ROOT=original_root/'__synthetic_cache_root_key_only__'
        other_root_key=a._immutable_git_read_key(sample,True)
    finally: a.ROOT=original_root
    assert other_root_key!=key_text and other_root_key[0]!=key_text[0]
    decoded=a.run_git(*sample,text=True)
    raw=a.run_git(*sample,text=False)
    assert isinstance(decoded,str) and isinstance(raw,bytes)
    assert calls.count(sample)==2, 'text and bytes reads must keep distinct cache keys'
    head_a=a.run_git('rev-parse','HEAD')
    head_b=a.run_git('rev-parse','HEAD')
    assert head_a==head_b and calls.count(('rev-parse','HEAD'))==2
    status_a=a.run_git('status','--short','--branch')
    status_b=a.run_git('status','--short','--branch')
    diff_a=a.run_git('diff','--name-only')
    diff_b=a.run_git('diff','--name-only')
    assert status_a==status_b and calls.count(('status','--short','--branch'))==2
    assert diff_a==diff_b and calls.count(('diff','--name-only'))==2
    missing='__r3_missing_immutable_cache_probe__'
    for _ in range(2):
        try: a.run_git('show',port['baseCommit']+':'+missing,text=False)
        except subprocess.CalledProcessError: pass
        else: raise AssertionError('missing immutable object read unexpectedly succeeded')
    assert calls.count(('show',port['baseCommit']+':'+missing))==2, 'failed reads must not be cached'
    a._GIT_READ_CACHE.clear(); a._GIT_READ_CACHE_BYTES=0; calls.clear()
    body=(a.ROOT/'app/release.json').read_text(encoding='utf-8')
    outer_one=a.restore_auth_dev_prepare_base('app/release.json',body)
    outer_first=len(calls); outer_unique=len(set(calls))
    outer_entries=len(a._GIT_READ_CACHE); outer_bytes=a._GIT_READ_CACHE_BYTES
    outer_two=a.restore_auth_dev_prepare_base('app/release.json',body)
    outer_second=len(calls)-outer_first
    assert outer_one==outer_two and outer_first==148 and outer_unique==148
    assert outer_second==0, ('outer-entry immutable reads repeated', outer_second)
    assert outer_entries==148 and outer_bytes<=a._GIT_READ_CACHE_MAX_BYTES
    assert outer_entries<=a._GIT_READ_CACHE_MAX_ENTRIES
finally:
    a.subprocess.run=original_run

bad=copy.deepcopy(port); bad['target']='public-main'
class ChangedFixture:
    def read_text(self,encoding='utf-8'): return json.dumps(bad)
original_fixture_path=a.R3_POLICY_552_AUTHORITY_PATH
a.R3_POLICY_552_AUTHORITY_PATH=ChangedFixture()
try:
    try: a._load_r3_policy_552_authority()
    except RuntimeError as error: assert str(error)=='R3 552 successor authority context mismatch'
    else: raise AssertionError('cached object reads bypassed fresh fixture validation')
finally: a.R3_POLICY_552_AUTHORITY_PATH=original_fixture_path
bad=copy.deepcopy(port); bad['files'][0]['afterSha256']='0'*64
try: a._load_r3_policy_552_authority(bad)
except RuntimeError as error: assert str(error).startswith('R3 552 release content drift:')
else: raise AssertionError('cached object reads bypassed current hash contract')
bad=copy.deepcopy(port); bad['commitStack']['releasePaths'].append('README.md')
try: a._load_r3_policy_552_authority(bad)
except RuntimeError as error: assert str(error)=='R3 552 successor authority context mismatch'
else: raise AssertionError('cached object reads bypassed exact path-set validation')
candidate=str(port['candidateCommit'])
feature=a.run_git('rev-parse',candidate+'^').strip()
original_run_git=a.run_git
def wrong_parent(*args,text=True):
    if args==('rev-list','--parents','-n','1',feature):
        value=feature+' '+'0'*40
        return value if text else value.encode()
    return original_run_git(*args,text=text)
a.run_git=wrong_parent
try:
    try: a._load_r3_policy_552_authority(port)
    except RuntimeError as error: assert str(error)=='R3 552 commit parent mismatch'
    else: raise AssertionError('cached reads bypassed exact parent validation')
finally: a.run_git=original_run_git

row=port['files'][0]
current=(a.ROOT/row['path']).read_text(encoding='utf-8').replace('\\r\\n','\\n')
assert hashlib.sha256(current.encode()).hexdigest()==row['afterSha256']
try: a._restore_r3_policy_552_content(row['path'],current+'\\n',port)
except RuntimeError as error: assert str(error)=='R3 552 successor candidate content drift: '+row['path']
else: raise AssertionError('working source hash drift was accepted')

old=(a._GIT_READ_CACHE_MAX_ENTRIES,a._GIT_READ_CACHE_MAX_BYTES,a._GIT_READ_CACHE_MAX_ITEM_BYTES)
try:
    a._GIT_READ_CACHE.clear(); a._GIT_READ_CACHE_BYTES=0
    a._GIT_READ_CACHE_MAX_ENTRIES=2; a._GIT_READ_CACHE_MAX_BYTES=8; a._GIT_READ_CACHE_MAX_ITEM_BYTES=8
    keys=[a._immutable_git_read_key(('show',port['baseCommit']+':'+path),False)
          for path in ('app/release.json','app/admin/index.html','app/tennis-note-member-app/app.js')]
    assert all(keys)
    for key in keys[:2]: a._cache_git_output(key,b'1234')
    assert len(a._GIT_READ_CACHE)==2 and a._GIT_READ_CACHE_BYTES==8
    a._GIT_READ_CACHE.move_to_end(keys[0])
    a._cache_git_output(keys[2],b'5678')
    assert len(a._GIT_READ_CACHE)==2 and a._GIT_READ_CACHE_BYTES==8
    assert keys[0] in a._GIT_READ_CACHE and keys[1] not in a._GIT_READ_CACHE and keys[2] in a._GIT_READ_CACHE
    a._cache_git_output(keys[1],b'x'*9)
    assert len(a._GIT_READ_CACHE)==2 and a._GIT_READ_CACHE_BYTES==8
finally:
    a._GIT_READ_CACHE_MAX_ENTRIES,a._GIT_READ_CACHE_MAX_BYTES,a._GIT_READ_CACHE_MAX_ITEM_BYTES=old
print('R3_552_IMMUTABLE_GIT_READ_CACHE_PASS; loader_calls=48; loader_repeat=0; outer_calls=148; outer_unique=148; outer_repeat=0; outer_outputs_identical=1; mutable_ref_status_diff_fresh=PASS; str_bytes_separate=PASS; failed_reads_cached=0; exact_drift_gates=PASS; bounded_lru=PASS')
`);
  assert.match(output, /R3_552_IMMUTABLE_GIT_READ_CACHE_PASS; loader_calls=48; loader_repeat=0; outer_calls=148; outer_unique=148; outer_repeat=0; outer_outputs_identical=1; mutable_ref_status_diff_fresh=PASS; str_bytes_separate=PASS; failed_reads_cached=0; exact_drift_gates=PASS; bounded_lru=PASS/);
});

test("R3 basic settlement inverse dispatches exact 1.0.552 content before 1.0.551", () => {
  const output = runPython(`
import subprocess, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as a
port=a._load_r3_policy_552_authority()
original=a.restore_r3_hourly_input_successor_base
observed=[]
def capture_551_dispatch(path,text):
    observed.append((path,text))
    return original(path,text)
a.restore_r3_hourly_input_successor_base=capture_551_dispatch
try:
    for row in port['files']:
        candidate=subprocess.check_output(['git','show',port['candidateCommit']+':'+row['path']]).decode('utf-8').replace('\\r\\n','\\n')
        a.restore_r3_basic_settlement_successor_base(row['path'],candidate)
        expected_551=subprocess.check_output(['git','show',port['baseCommit']+':'+row['path']]).decode('utf-8').replace('\\r\\n','\\n')
        if row['path'] in a.R3_POLICY_551_EXPECTED_PATHS:
            assert observed[-1]==(row['path'],expected_551), '552 inverse must feed exact 551 source to the next inverse'
finally:
    a.restore_r3_hourly_input_successor_base=original
assert len(observed)==len(a.R3_POLICY_551_EXPECTED_PATHS & a.R3_POLICY_552_CONTENT_PATHS)
print('R3_552_TOP_LEVEL_TO_551_EXACT_DISPATCH_PASS')
`);
  assert.match(output, /R3_552_TOP_LEVEL_TO_551_EXACT_DISPATCH_PASS/);
});
