import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const root=join(dirname(fileURLToPath(import.meta.url)),"..");

test("DEV target/account/branch/rollback 불일치는 기존 GET 이전 또는 배포 이전에 실패",()=>{
  const result=execFileSync(process.env.TENNISNOTE_PYTHON || "python",["-B","-c",`
import hashlib, sys
sys.path.insert(0, 'scripts')
import check_tennisnote_development_deploy_scope as d
account='a'*32
ref='fixture-dev-only'
d.DEV_PROJECT_FINGERPRINT=hashlib.sha256(ref.encode()).hexdigest()[:12]
env={'GITHUB_EVENT_NAME':'push','GITHUB_REF':'refs/heads/dev','GITHUB_SHA':'b'*40,
'GITHUB_REPOSITORY':d.REPOSITORY,'TENNISNOTE_CALLER_WORKFLOW_REF':d.CALLER_WORKFLOW,
'TENNISNOTE_ENVIRONMENT':'development','TENNISNOTE_PAYMENTS_ENABLED':'false','TENNISNOTE_PAYMENT_MODE':'disabled',
'TENNISNOTE_BANK_TRANSFER_ENABLED':'false','TENNISNOTE_ALLOWED_PAYMENT_METHODS':'',
'TENNISNOTE_SUPABASE_URL':'https://'+ref+'.supabase.co','CLOUDFLARE_ACCOUNT_ID':account,
'EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT':hashlib.sha256(account.encode()).hexdigest(),'CLOUDFLARE_API_TOKEN':'synthetic-token'}
assert d.validate_context(env,'b'*40)[0]==account
negative=0
for key,value in [('GITHUB_REPOSITORY','synthetic-owner/another-repo'),('TENNISNOTE_CALLER_WORKFLOW_REF',d.REPOSITORY+'/.github/workflows/alternate.yml@refs/heads/dev'),
('GITHUB_EVENT_NAME','workflow_dispatch'),('GITHUB_REF','refs/heads/main'),('GITHUB_SHA','c'*40),
('TENNISNOTE_ENVIRONMENT','production'),('TENNISNOTE_PAYMENTS_ENABLED','true'),('TENNISNOTE_PAYMENT_MODE','multi'),
('TENNISNOTE_BANK_TRANSFER_ENABLED','true'),('TENNISNOTE_ALLOWED_PAYMENT_METHODS','tosspay'),
('TENNISNOTE_SUPABASE_URL','https://fixture-prod-only.supabase.co'),('CLOUDFLARE_ACCOUNT_ID','c'*32),
('EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT',''),('CLOUDFLARE_API_TOKEN','')]:
    try: d.validate_context({**env,key:value},'b'*40)
    except d.ScopeError: negative+=1
    else: raise AssertionError('context mismatch accepted')
assert negative==14
calls=[]
def get(suffix):
    calls.append(suffix)
    name=suffix.split('/')[3]
    if '/deployments?' not in suffix: return {'success':True,'result':{'name':name,'production_branch':'dev'}}
    return {'success':True,'result':[{'id':'00000000-0000-4000-8000-000000000001','environment':'production',
      'latest_stage':{'status':'success'},'deployment_trigger':{'metadata':{'branch':'dev'}}}]}
assert set(d.verify_existing_projects(get))==set(d.PROJECTS)
assert len(calls)==4 and all(name in '/'.join(calls) for name in d.PROJECTS)
for kind in ('project-missing','branch-mismatch','rollback-missing','rollback-failed','rollback-preview','rollback-branch'):
    def broken(suffix):
        value=get(suffix)
        if '/deployments?' not in suffix:
            if kind=='project-missing': value['success']=False
            if kind=='branch-mismatch': value['result']['production_branch']='main'
        else:
            if kind=='rollback-missing': value['result']=[]
            if kind=='rollback-failed': value['result'][0]['latest_stage']['status']='failure'
            if kind=='rollback-preview': value['result'][0]['environment']='preview'
            if kind=='rollback-branch': value['result'][0]['deployment_trigger']['metadata']['branch']='main'
        return value
    try: d.verify_existing_projects(broken)
    except d.ScopeError: negative+=1
    else: raise AssertionError('project/rollback mismatch accepted')
d.validate_source()
print('DEV_SCOPE_PASS negative='+str(negative)+' apiWrites=0 DBClients=0')
`],{cwd:root,encoding:"utf8",maxBuffer:2e6});
  assert.match(result,/DEV_SCOPE_PASS negative=20 apiWrites=0 DBClients=0/);
});

test("개발 deploy는 CI 성공 뒤의 같은 SHA·기존 DEV 두 프로젝트만 사용",()=>{
  const deploy=readFileSync(join(root,".github/workflows/deploy-cloudflare-pages-dev.yml"),"utf8");
  const caller=readFileSync(join(root,".github/workflows/tennisnote-public-ci.yml"),"utf8");
  const check=(d,c)=>{
    assert.match(d,/^  workflow_call:\s*$/m);assert.doesNotMatch(d,/^  (?:push|workflow_dispatch|pull_request):/m);
    assert.match(d,/^          ref: \$\{\{ github.sha \}\}$/m);
    assert.match(d,/^          fetch-depth: 0$/m);
    assert.match(d,/^      EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT: \$\{\{ vars.DEV_CLOUDFLARE_ACCOUNT_FINGERPRINT \}\}$/m);
    assert.match(d,/^      TENNISNOTE_CALLER_WORKFLOW_REF: \$\{\{ github.workflow_ref \}\}$/m);
    assert.match(c,/^  deploy-development-after-ci:\s*\n    if:.*github.event_name == 'push'.*github.ref == 'refs\/heads\/dev'.*\n    needs: build-and-check\s*\n    uses: \.\/.github\/workflows\/deploy-cloudflare-pages-dev.yml/m);
    const expected=[['member development PWA','member-dev','tennisnote-app-dev'],['administrator development web','admin-dev','tennisnote-admin-dev']];
    for(const [label,folder,project] of expected){
      const line=d.match(new RegExp('- name: Deploy '+label+'\\r?\\n\\s+run: ([^\\r\\n]+)'))?.[1];
      assert.equal(line,'npx --yes wrangler@3.90.0 pages deploy dist/'+folder+' --project-name='+project+' --branch=dev');
    }
    assert.equal((d.match(/pages deploy /g)||[]).length,2);assert.doesNotMatch(d,/pages project create/);
  };
  check(deploy,caller);
  assert.throws(()=>check(deploy.replace('--project-name=tennisnote-app-dev','--project-name=tennisnote-app'),caller));
  assert.throws(()=>check(deploy,caller.replace('needs: build-and-check','needs: unknown')));
  assert.throws(()=>check(deploy,caller.replace("github.ref == 'refs/heads/dev'","github.ref == 'refs/heads/main'")));
});

test("DEV checkout history successor is exact, preserves frozen Auth inverse, and fails before API on shallow history",()=>{
  const result=execFileSync(process.env.TENNISNOTE_PYTHON || "python",["-B","-c",`
import contextlib, hashlib, io, json, os, subprocess, sys
from pathlib import Path
from unittest.mock import patch
sys.path.insert(0, 'scripts')
import check_tennisnote_dev_prod_alignment as a
import check_tennisnote_development_deploy_scope as d
workflow_path='.github/workflows/deploy-cloudflare-pages-dev.yml'
port=json.loads(Path('tests/fixtures/development-checkout-history-source-parity.json').read_text(encoding='utf-8'))
row=port['files'][0]
text=Path(workflow_path).read_text(encoding='utf-8')
sha=lambda value:hashlib.sha256(value.encode('utf-8')).hexdigest()
assert port['contract']=='development-checkout-history-source-parity/1'
assert len(port['files'])==1 and row['path']==workflow_path
assert row['beforeSha256']==a.DEV_CHECKOUT_HISTORY_BEFORE_SHA256
assert len(row['hunks'])==1 and row['hunks'][0]['count']==1
assert sha(text)==row['afterSha256']
baseline=a.restore_development_checkout_history_base(workflow_path,text,port)
assert sha(baseline)==row['beforeSha256']
assert a.restore_development_checkout_history_base(workflow_path,baseline,port)==baseline
old=json.loads(Path('tests/fixtures/auth-only-development-prepare-source-parity.json').read_text(encoding='utf-8'))
oldrow=next(x for x in old['files'] if x['path']==workflow_path)
assert sha(baseline)==oldrow['afterSha256']
historical=a.restore_auth_dev_prepare_base_legacy(workflow_path,baseline)
assert sha(historical)==oldrow['beforeSha256']
nl=chr(10); fetch='          fetch-depth: 0'+nl
bad=[text.replace(fetch,'          fetch-depth: 1'+nl,1),
     text.replace(fetch,fetch+fetch,1),
     text.replace(fetch,'',1)+fetch]
negative=0
for value in bad:
    try:a.restore_development_checkout_history_base(workflow_path,value,port)
    except RuntimeError:negative+=1
    else:raise AssertionError('workflow tamper accepted')
for mutate in [lambda p:p['files'][0].update(path='different.yml'),
               lambda p:p['files'][0]['hunks'][0].update(count=0),
               lambda p:p['files'][0]['hunks'][0].update(count=2),
               lambda p:p['files'][0]['hunks'][0].update(after='          ref: '+chr(36)+'{{ github.sha }}'+nl+'          fetch-depth: 1'+nl),
               lambda p:p['files'][0].update(beforeSha256='1'*64),
               lambda p:p['files'][0].update(extra='unexpected')]:
    bad_port=json.loads(json.dumps(port));mutate(bad_port)
    try:a.restore_development_checkout_history_base(workflow_path,text,bad_port)
    except RuntimeError:negative+=1
    else:raise AssertionError('authority tamper accepted')
assert negative==9

def run_missing_history(mode):
    git_calls=[];api_calls=[];counter={'rev-list':0}
    def fake_git(*args,text=True):
        git_calls.append(args)
        if args and args[0]=='rev-list':
            counter['rev-list']+=1
            if mode=='missing-candidate' or counter['rev-list']>1:
                raise subprocess.CalledProcessError(128,['git'])
            return args[-1]+' '+'f'*40+chr(10)
        raise subprocess.CalledProcessError(128,['git'])
    a.run_git=fake_git
    d.subprocess.check_output=lambda *args,**kwargs:'b'*40
    d.urllib.request.urlopen=lambda *args,**kwargs:api_calls.append(True)
    ref='fixture-dev-only';account='a'*32
    env={'GITHUB_EVENT_NAME':'push','GITHUB_REF':'refs/heads/dev','GITHUB_SHA':'b'*40,
      'GITHUB_REPOSITORY':d.REPOSITORY,'TENNISNOTE_CALLER_WORKFLOW_REF':d.CALLER_WORKFLOW,
      'TENNISNOTE_ENVIRONMENT':'development','TENNISNOTE_PAYMENTS_ENABLED':'false','TENNISNOTE_PAYMENT_MODE':'disabled',
      'TENNISNOTE_BANK_TRANSFER_ENABLED':'false','TENNISNOTE_ALLOWED_PAYMENT_METHODS':'',
      'TENNISNOTE_SUPABASE_URL':'https://'+ref+'.supabase.co','CLOUDFLARE_ACCOUNT_ID':account,
      'EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT':hashlib.sha256(account.encode()).hexdigest(),
      'CLOUDFLARE_API_TOKEN':'synthetic-only'}
    d.DEV_PROJECT_FINGERPRINT=hashlib.sha256(ref.encode()).hexdigest()[:12]
    stderr=io.StringIO()
    with patch.dict(os.environ,env,clear=False),contextlib.redirect_stderr(stderr):
        code=d.main()
    assert code==1 and 'DEPLOY_SCOPE_FAIL:development_scope_unconfirmed' in stderr.getvalue()
    assert api_calls==[] and counter['rev-list']==(1 if mode=='missing-candidate' else 2)
for mode in ('missing-candidate','shallow-parent'):
    run_missing_history(mode)
print('DEV_HISTORY_AUTHORITY_PASS inverse=1 frozen_auth=1 tamper_negative=9 shallow_history=2 apiReads=0')
`],{cwd:root,encoding:"utf8",maxBuffer:2e6});
  assert.match(result,/DEV_HISTORY_AUTHORITY_PASS inverse=1 frozen_auth=1 tamper_negative=9 shallow_history=2 apiReads=0/);
});
