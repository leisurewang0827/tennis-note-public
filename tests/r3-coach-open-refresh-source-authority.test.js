import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { createRequire } from "node:module";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const python = process.env.TENNISNOTE_PYTHON || "python";
const require = createRequire(import.meta.url);
const setup = String.raw`
import copy, hashlib, json, subprocess, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as a
port=json.loads(a.R3_OPEN_REFRESH_AUTHORITY_PATH.read_text(encoding='utf-8'))
def git_text(revision,path):
    return subprocess.check_output(['git','show',revision+':'+path]).decode('utf-8').replace('\r\n','\n')
def must_fail(call):
    try: call()
    except (RuntimeError, subprocess.CalledProcessError): return
    raise AssertionError('forged open-refresh authority accepted')
`;
function run(body) {
  return execFileSync(python, ["-B", "-c", setup + body], {
    cwd: root, encoding: "utf8", maxBuffer: 2 * 1024 * 1024,
    env: { ...process.env, PYTHONIOENCODING: "utf-8" },
  });
}

test("555 exact Git blobs, 16 inverses, and real DEV deploy entry preserve the frozen chain", () => {
  assert.match(run(String.raw`
checked=a._load_r3_coach_open_refresh_authority()
assert len(checked['files'])==16
for row in checked['files']:
    current=git_text(checked['candidateCommit'],row['path'])
    base=git_text(checked['baseCommit'],row['path'])
    assert a.restore_r3_coach_open_refresh_base(row['path'],current)==base
    assert a.restore_r3_coach_open_refresh_base(row['path'],base)==base
    assert a.sha256(base.encode())==row['beforeSha256']
    assert a.sha256(current.encode())==row['afterSha256']
# The actual deployment checker calls this public entry directly, not an invented wrapper.
import check_tennisnote_development_deploy_scope as deploy
frozen=json.loads((a.ROOT/'tests/fixtures/auth-only-development-prepare-source-parity.json').read_text(encoding='utf-8'))
current=git_text(checked['candidateCommit'],'app/release.json')
assert deploy.validate_frozen_release_metadata(current,frozen['release'])=={'version':'1.0.555','releaseId':'2026.10.24.03'}
assert a.restore_auth_dev_prepare_base('app/release.json',current)==a.restore_auth_dev_prepare_base('app/release.json',git_text(checked['baseCommit'],'app/release.json'))
print('EXACT_16_GIT_INVERSE_AND_DEPLOY_ENTRY_PASS')
`), /EXACT_16_GIT_INVERSE_AND_DEPLOY_ENTRY_PASS/);
});

test("forged metadata, wrong base/blob/hash, outside/duplicate paths and inverse edits fail closed", () => {
  assert.match(run(String.raw`
fields=[('baseCommit','0'*40),('featureCommit','1'*40),('candidateCommit','2'*40),
        ('target','public-main'),('targetBranch','main'),('targetVersion','1.0.556'),
        ('targetReleaseId','2026.10.24.99'),('memberCacheAfter',592),('coachCacheAfter',565)]
count=0
for field,value in fields:
    bad=copy.deepcopy(port);bad[field]=value
    must_fail(lambda bad=bad:a._load_r3_coach_open_refresh_authority(bad));count+=1
for field,value in [('gitBlob','0'*40),('canonicalLfSha256','0'*64),('basicFunctionSha256','0'*64)]:
    bad=copy.deepcopy(port);bad['privateSource'][field]=value
    must_fail(lambda bad=bad:a._load_r3_coach_open_refresh_authority(bad));count+=1
for field,value in [('beforeGitBlob','0'*40),('afterGitBlob','0'*40),('beforeSha256','0'*64),('afterSha256','0'*64)]:
    bad=copy.deepcopy(port);bad['files'][0][field]=value
    must_fail(lambda bad=bad:a._load_r3_coach_open_refresh_authority(bad));count+=1
for change in ('outside','duplicate','missing','hunk','extra-hunk'):
    bad=copy.deepcopy(port)
    if change=='outside':bad['files'][0]['path']='app/shared/tennisnote-data-client.js'
    elif change=='duplicate':bad['files'][0]=copy.deepcopy(bad['files'][1])
    elif change=='missing':bad['files'].pop()
    elif change=='hunk':bad['files'][0]['hunks'][0]['after']+='one-byte-drift'
    else:bad['files'][0]['hunks'].append(copy.deepcopy(bad['files'][0]['hunks'][0]))
    must_fail(lambda bad=bad:a._load_r3_coach_open_refresh_authority(bad));count+=1
assert count==21
print('FORGED_NEGATIVES_21_PASS')
`), /FORGED_NEGATIVES_21_PASS/);
});

test("one-byte or duplicate source, version/cache drift and unbound candidate cannot deploy", () => {
  assert.match(run(String.raw`
for row in port['files']:
    current=git_text(port['candidateCommit'],row['path'])
    must_fail(lambda row=row,current=current:a.restore_r3_coach_open_refresh_base(row['path'],current+'x'))
row=next(r for r in port['files'] if r['path']=='app/tennis-note-coach-app/ui/screens.js')
current=git_text(port['candidateCommit'],row['path'])
must_fail(lambda:a.restore_r3_coach_open_refresh_base(row['path'],current+row['hunks'][0]['after']))
bad=copy.deepcopy(port);bad['bindingStatus']='PENDING_EXACT_FEATURE_RELEASE';bad['candidateCommit']=None
must_fail(lambda:a._load_r3_coach_open_refresh_authority(bad))
for path,old,new in [('app/release.json','1.0.555','1.0.556'),
    ('app/tennis-note-member-app/service-worker.js','pwa-v591','pwa-v592'),
    ('app/tennis-note-coach-app/service-worker.js','mode-v564','mode-v565')]:
    current=git_text(port['candidateCommit'],path)
    assert old in current
    must_fail(lambda path=path,current=current,old=old,new=new:a.restore_r3_coach_open_refresh_base(path,current.replace(old,new)))
assert a.restore_r3_coach_open_refresh_base('app/shared/tennisnote-data-client.js','unchanged')=='unchanged'
import check_tennisnote_development_deploy_scope as deploy
frozen=json.loads((a.ROOT/'tests/fixtures/auth-only-development-prepare-source-parity.json').read_text(encoding='utf-8'))
current=git_text(port['candidateCommit'],'app/release.json')
for changed in (current+' ',current.replace('1.0.555','1.0.556'),current.replace('2026.10.24.03','2026.10.24.99')):
    must_fail(lambda changed=changed:deploy.validate_frozen_release_metadata(changed,frozen['release']))
print('SOURCE_AND_PENDING_FAIL_CLOSED_PASS')
`), /SOURCE_AND_PENDING_FAIL_CLOSED_PASS/);
});

test("new inverse does not mutate historical authority or BASIC computation", () => {
  assert.match(run(String.raw`
import re
path='app/tennis-note-coach-app/data/sync.js'
base=git_text(port['baseCommit'],path);candidate=git_text(port['candidateCommit'],path)
assert candidate==base
fn=re.search(r'^async function syncCoachSettlementFromServer\([\s\S]*?^}',candidate,re.M).group()
assert hashlib.sha256(fn.encode()).hexdigest()==port['privateSource']['basicFunctionSha256']
for historical in ('tests/fixtures/r3-manual-payout-port-source-authority.json','tests/fixtures/auth-only-development-prepare-source-parity.json'):
    assert git_text(port['baseCommit'],historical)==(a.ROOT/historical).read_text(encoding='utf-8').replace('\r\n','\n')
old=json.loads(a.R3_MANUAL_PAYOUT_SOURCE_AUTHORITY_PATH.read_text(encoding='utf-8'))['releaseSuccessor']
path='app/release.json'
historical=git_text(old['candidateCommit'],path)
assert a.restore_r3_coach_open_refresh_base(path,historical,strict=False)==historical
assert a.restore_r3_manual_payout_successor_base(path,historical)==git_text(old['baseCommit'],path)
print('FROZEN_HISTORY_BASIC_COMPUTATION_PASS')
`), /FROZEN_HISTORY_BASIC_COMPUTATION_PASS/);
});

test("555 JS historical routes prove exact inverses and reject drift without changing old golden", () => {
  const helper = require("./helpers/r3-history-port.cjs");
  const renewal = require("./helpers/renewal-hold-port.cjs");
  const authorityPath = path.join(root, "tests/fixtures/r3-coach-open-refresh-source-parity.json");
  const raw = fs.readFileSync(authorityPath, "utf8");
  const port = JSON.parse(raw);
  const gitText = (revision, file) => execFileSync("git", ["show", revision + ":" + file],
    {cwd: root, encoding: "utf8"}).replace(/\r\n/g, "\n");
  for (const row of port.files) {
    const current = gitText(port.candidateCommit, row.path);
    assert.equal(helper.restoreOpenRefresh(row.path, current), gitText(port.baseCommit, row.path));
    for (const inputVersion of ["1.0.555", "1.0.554", "1.0.552"]) {
      assert.throws(() => helper.restoreOpenRefresh(row.path, current + " ", {inputVersion}), /stage drift/);
      assert.throws(() => helper.restoreOpenRefresh(row.path, current + row.hunks[0].after, {inputVersion}), /stage drift/);
    }
  }
  const file = "app/admin/index.html";
  const current = gitText(port.candidateCommit, file);
  const old = JSON.parse(fs.readFileSync(path.join(root, "tests/fixtures/r3-manual-payout-port-source-authority.json"), "utf8")).releaseSuccessor;
  assert.equal(renewal.restoreManualPayoutAdminIndex(file, current, port.targetVersion), gitText(old.baseCommit, file));
  assert.equal(renewal.restoreManualPayoutAdminIndex(file, current, old.targetVersion), gitText(old.baseCommit, file));
  assert.throws(() => renewal.restoreManualPayoutAdminIndex(file, current + " ", port.targetVersion), /stage drift/);
  // 이전에 검증된 module cache가 변조된 새 fixture를 가리지 않아야 한다.
  const originalRead = fs.readFileSync;
  for (const change of [
    p => { p.target = "public-main"; },
    p => { p.files[0].beforeGitBlob = "0".repeat(40); },
    p => { p.files.push({...p.files[0]}); },
  ]) {
    const bad = JSON.parse(raw); change(bad);
    fs.readFileSync = function (target, ...args) {
      if (path.resolve(String(target)) === authorityPath) return JSON.stringify(bad);
      return originalRead.call(this, target, ...args);
    };
    try { assert.throws(() => helper.restoreOpenRefresh(file, current)); }
    finally { fs.readFileSync = originalRead; }
  }
});

test("555 cold and warm reads separate the frozen158 set from exact new immutable reads", () => {
  assert.match(run(String.raw`
original_run=a.subprocess.run
calls=[]
old=json.loads(a.R3_MANUAL_PAYOUT_SOURCE_AUTHORITY_PATH.read_text(encoding='utf-8'))['releaseSuccessor']
legacy=git_text(old['candidateCommit'],'app/release.json')
current=git_text(port['candidateCommit'],'app/release.json')
def counted(cmd,*args,**kwargs):
    if isinstance(cmd,list) and cmd and cmd[0]=='git':
        calls.append((tuple(cmd[1:]),kwargs.get('text',False)))
    return original_run(cmd,*args,**kwargs)
a.subprocess.run=counted
try:
    a._GIT_READ_CACHE.clear();a._GIT_READ_CACHE_BYTES=0
    legacy_result=a.restore_auth_dev_prepare_base('app/release.json',legacy)
    legacy_calls=list(calls);legacy_set=set(calls)
    assert len(legacy_calls)==158 and len({args for args,text in legacy_calls})==156
    assert len(legacy_set)==158 and len(a._GIT_READ_CACHE)==158
    additions={
        (('rev-list','--parents','-n','1',port['featureCommit']),True),
        (('rev-list','--parents','-n','1',port['candidateCommit']),True),
        (('diff-tree','--no-commit-id','--name-only','-r',port['featureCommit']),True),
        (('diff-tree','--no-commit-id','--name-only','-r',port['candidateCommit']),True),
    }
    for row in port['files']:
        for revision in (port['baseCommit'],port['candidateCommit']):
            additions.add((('show',revision+':'+row['path']),False))
    for revision in (port['baseCommit'],port['candidateCommit']):
        additions.add((('show',revision+':app/release.json'),True))
    for file in ('app/tennis-note-member-app/service-worker.js','app/tennis-note-coach-app/service-worker.js'):
        additions.add((('show',port['candidateCommit']+':'+file),True))
    assert len(additions)==40 and not additions.intersection(legacy_set)
    a._GIT_READ_CACHE.clear();a._GIT_READ_CACHE_BYTES=0;calls.clear()
    cold=a.restore_auth_dev_prepare_base('app/release.json',current)
    assert cold==legacy_result
    assert set(calls)==legacy_set|additions
    assert len(calls)==len(legacy_calls)+len(additions)==198
    assert len(a._GIT_READ_CACHE)==198
    assert len(a._GIT_READ_CACHE)<=a._GIT_READ_CACHE_MAX_ENTRIES==512
    assert a._GIT_READ_CACHE_BYTES<=a._GIT_READ_CACHE_MAX_BYTES==16*1024*1024
    calls.clear()
    assert a.restore_auth_dev_prepare_base('app/release.json',current)==cold
    assert calls==[], '555 warm immutable reads repeated'
    bad=copy.deepcopy(port);bad['target']='public-main'
    class ChangedFixture:
        def read_text(self,encoding='utf-8'): return json.dumps(bad)
    original_path=a.R3_OPEN_REFRESH_AUTHORITY_PATH
    a.R3_OPEN_REFRESH_AUTHORITY_PATH=ChangedFixture()
    try: must_fail(lambda:a.restore_auth_dev_prepare_base('app/release.json',current))
    finally: a.R3_OPEN_REFRESH_AUTHORITY_PATH=original_path
    must_fail(lambda:a.restore_auth_dev_prepare_base('app/release.json',current+' '))
finally:
    a.subprocess.run=original_run
print('FROZEN158_PLUS_EXACT40_COLD198_WARM0_PASS')
`), /FROZEN158_PLUS_EXACT40_COLD198_WARM0_PASS/);
});

test("555 JS owned-row omission and outside-path substitution fail before passthrough", () => {
  const helper = require("./helpers/r3-history-port.cjs");
  const authorityPath = path.join(root, "tests/fixtures/r3-coach-open-refresh-source-parity.json");
  const raw = fs.readFileSync(authorityPath, "utf8");
  const port = JSON.parse(raw), file = "app/admin/index.html";
  const source = execFileSync("git", ["show", port.candidateCommit + ":" + file],
    {cwd: root, encoding: "utf8"}).replace(/\r\n/g, "\n");
  const originalRead = fs.readFileSync;
  for (const change of [
    p => { p.files = p.files.filter(row => row.path !== file); },
    p => { p.files.find(row => row.path === file).path = "app/shared/unapproved-outside-path.js"; },
  ]) {
    const bad = JSON.parse(raw); change(bad);
    fs.readFileSync = function (target, ...args) {
      if (path.resolve(String(target)) === authorityPath) return JSON.stringify(bad);
      return originalRead.call(this, target, ...args);
    };
    try { assert.throws(() => helper.restoreOpenRefresh(file, source)); }
    finally { fs.readFileSync = originalRead; }
  }
});
