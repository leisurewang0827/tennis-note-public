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
