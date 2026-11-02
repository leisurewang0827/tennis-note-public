"""Exact DEV573 successor only; no unknown-ref fallback and no hosted writes."""
import hashlib
import json
import os
from pathlib import Path
import re
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = '1ee91d9adb8ce574dcc9ca9e91b5621dd712a2cc'
BASE_BRANCH = 'codex/tennisnote-personal-create-partner-scope-20261101'
BRANCH = 'codex/r3-dispute-adjustment-resolution-dev574-20261102'
REPO = 'leisurewang0827/tennis-note-public'
SELF_SEAL = '9a942471810476ecc861cc9bdcd5e9860028e673338e5741d05d74463a1ea350'
APP_PINS = {
    'app/admin/index.html': 'f4c1c89e10bf1a7a739471f8e3a1180a7b38fd56fd846248bdd7def2376e3397',
    'app/admin/views/billing.js': 'dbb5122c9ec5ff5892bb70f70408f5a59ca44d2405a0c55362b544dcdf8ec134',
    'app/release.json': 'ee2788f9d01c2c7adc8acbafc06eac1d126955cca117f4769724c118ace56f9a',
    'app/shared/tennisnote-release.js': 'a41910873212c44687b1fc116ae1b95fc8b04be67e3dbe717b84fd8c014bc04b',
    'app/shared/tennisnote-settlement-adjustment.js': 'e4279280929ae5904dfe1d4d7b97bd7ca92b7c072cb7f562a5810498f2738a1e',
    'app/tennis-note-coach-app/app.js': 'eb4073046ce53bac46acb27adfcb0d6db70f917b0c7905f190b57769a081c7cd',
    'app/tennis-note-coach-app/domain/coaches.js': '4813e522c2c4473cca29b2942e8f54daa9b09b9f0227c03f9c98b652c5c0bc61',
    'app/tennis-note-coach-app/forms/common.js': '37b14180a1fdc1030425b9ea99f28ed72b10ec128121da2466b9b690b1254f63',
    'app/tennis-note-coach-app/index.html': '9487682d67bfcbbb49b177fcac704556fddcd833d9bb23363f490a1e180fd56e',
    'app/tennis-note-coach-app/service-worker.js': '4784e3b1e3ff22e3eebe4ead7382fd9ecece5ef8db79211bf2b9d0bfc59ecbaa',
    'app/tennis-note-coach-app/views/settlement.js': '3ffd9982cdd6aada4af91baf0d28211cdb8408788759f602830eb18fedef19d0',
    'app/tennis-note-member-app/app.js': '2ace3f594d77527b1afdb7ec4844fc77bff09cfb7131db0832045c445e9440e9',
    'app/tennis-note-member-app/forms/common.js': '7de8ca9240b4d37ad498e29fb5f27147f198207b96ed3a733fc5c1f1fac5ffc8',
    'app/tennis-note-member-app/index.html': 'a573f661a9ba5fcab16b93d1d01a9763ef82af24eef72a3a12562fafc36fadd7',
    'app/tennis-note-member-app/service-worker.js': 'f33587ae171f5a178d02ba145a15ec2592d85c00b3b89ac8642e42876fab4d02',
    'app/tennis-note-member-app/ui/screens.js': '094bf5112fe422cb88ce68d4404c396972ecf290e7b9fed5de04a088f877be7d',
}
AUX_PINS = {
    '.github/workflows/tennisnote-public-ci.yml': '4b08947c77746b2a9ca3be316f5ca0f1e7e3d1974b68ec038c2e6843e2396a3e',
    'scripts/check_r3_dev_deployment.py': 'd4cb065c139257cfdf753d689e784f9fa19d6f5d7ac190cfc910c70de86e6d05',
    'tests/r3-dispute-dev574-admission.test.py': '4fbd588ff4da2b48d1a85ffd66d32de0c88cf2d53c2edd33305f0772b3870908',
}
SELF = 'scripts/check_r3_dispute_dev574.py'
LIVE_BASE = {
    'https://tennisnote-app-dev.pages.dev/shared/tennisnote-settlement-adjustment.js': 'd55ca914171ce380eed3e3b35d7d363428170530518e2824175cce2d3e33deb2',
    'https://tennisnote-admin-dev.pages.dev/views/billing.js': 'ce7e39d73116a20f16173153a1a22035f9d9c6da3f2d13bd001c367df917dd3d',
    'https://tennisnote-app-dev.pages.dev/tennis-note-coach-app/views/settlement.js': '17afef06505784f4f5c05b724c254d28303a76a4f47a48ee8f1aebacf0800290',
}


def need(value, code):
    if not value:
        raise RuntimeError(code)


def digest(data):
    return hashlib.sha256(data.replace(b'\r\n',b'\n')).hexdigest()


def self_seal(data):
    data,count=re.subn(rb"(?m)^SELF_SEAL = '[^']+'$",b"SELF_SEAL = 'PENDING'",data.replace(b'\r\n',b'\n'))
    need(count==1,'DEV574_SELF_SHAPE')
    return hashlib.sha256(data).hexdigest()


def context(env,head,old):
    sha=env.get('TENNISNOTE_CANDIDATE_SHA','')
    need(env.get('GITHUB_EVENT_NAME')=='workflow_dispatch' and env.get('GITHUB_REPOSITORY')==REPO
         and env.get('GITHUB_REF')=='refs/heads/'+BRANCH and env.get('GITHUB_REF_TYPE')=='branch'
         and env.get('GITHUB_WORKFLOW')==old.EXPECTED_WORKFLOW_NAME and env.get('GITHUB_RUN_ATTEMPT')=='1'
         and env.get('TENNISNOTE_WORKFLOW_REF')==REPO+'/.github/workflows/deploy-cloudflare-pages-dev.yml@refs/heads/'+BRANCH
         and re.fullmatch(r'[0-9a-f]{40}',sha or '') is not None
         and sha==head==env.get('GITHUB_SHA'),'DEV574_CONTEXT')
    return sha


def source(candidate,checkout,old):
    need(old.run_git('rev-parse','HEAD')==checkout
         and old.run_git('show','-s','--format=%P',candidate)==BASE
         and old.run_git('rev-parse',checkout+'^{tree}')==old.run_git('rev-parse',candidate+'^{tree}')
         and not old.run_git('status','--porcelain','--untracked-files=all')
         and not old.run_git('diff','--cached','--name-only'),'DEV574_GRAPH')
    rows=[line.split('\t') for line in old.run_git('diff','--no-renames','--name-status',BASE,candidate).splitlines()]
    allowed=set(APP_PINS)|set(AUX_PINS)|{SELF}
    need(len(rows)==len(allowed) and all(len(r)==2 and r[0] in ('A','M') for r in rows)
         and {r[1] for r in rows}==allowed,'DEV574_PATHS')
    for name,expected in (APP_PINS|AUX_PINS).items():
        p=ROOT/name
        need(p.is_file() and not p.is_symlink() and digest(p.read_bytes())==expected,'DEV574_PIN')
    need(self_seal((ROOT/SELF).read_bytes())==SELF_SEAL,'DEV574_SELF')
    release=json.loads((ROOT/'app/release.json').read_text(encoding='utf-8'))
    need(release.get('version')==release.get('appSurfaceVersion')=='1.0.574'
         and release.get('releaseId')=='2026.11.02.01','DEV574_RELEASE')
    need(old._cache_counter((ROOT/'app/tennis-note-member-app/service-worker.js').read_text(encoding='utf-8'),'tennis-note-member-pwa-')==607
         and old._cache_counter((ROOT/'app/tennis-note-coach-app/service-worker.js').read_text(encoding='utf-8'),'tennis-note-coach-mode-')==580,'DEV574_CACHE')
    return release


def ci_pr(event,env,old):
    pr=event.get('pull_request') if isinstance(event,dict) else None
    need(env.get('GITHUB_EVENT_NAME')=='pull_request' and env.get('GITHUB_REPOSITORY')==REPO
         and env.get('GITHUB_RUN_ATTEMPT')=='1' and isinstance(pr,dict)
         and (pr.get('base') or {}).get('sha')==BASE and (pr.get('base') or {}).get('ref')==BASE_BRANCH
         and ((pr.get('base') or {}).get('repo') or {}).get('full_name')==REPO
         and (pr.get('head') or {}).get('ref')==BRANCH and ((pr.get('head') or {}).get('repo') or {}).get('full_name')==REPO,'DEV574_EVENT')
    candidate=(pr['head'] or {}).get('sha',''); merge=env.get('GITHUB_SHA','')
    need(re.fullmatch(r'[0-9a-f]{40}',candidate or '') is not None and re.fullmatch(r'[0-9a-f]{40}',merge or '') is not None
         and merge!=candidate and old.run_git('rev-parse','HEAD')==merge
         and old.run_git('show','-s','--format=%P',merge)==BASE+' '+candidate,'DEV574_VIRTUAL_MERGE')
    source(candidate,merge,old)
    return candidate


def ci_result(candidate,old):
    listing=old.status_dev_github_get('actions/workflows/tennisnote-public-ci.yml/runs?head_sha='+candidate+'&event=pull_request&per_page=100')
    runs=listing.get('workflow_runs') if isinstance(listing,dict) else None
    need(isinstance(runs,list) and len(runs)==1,'DEV574_CI_COUNT')
    run=runs[0]; links=run.get('pull_requests') or []
    need(len(links)==1 and type(links[0].get('number')) is int and links[0]['number']>0,'DEV574_PR_COUNT')
    pr=old.status_dev_github_get('pulls/'+str(links[0]['number']))
    need(pr.get('state')=='open' and (pr.get('head') or {}).get('sha')==candidate
         and (pr.get('head') or {}).get('ref')==BRANCH and (pr.get('base') or {}).get('sha')==BASE
         and (pr.get('base') or {}).get('ref')==BASE_BRANCH
         and ((pr.get('head') or {}).get('repo') or {}).get('full_name')==REPO
         and ((pr.get('base') or {}).get('repo') or {}).get('full_name')==REPO
         and pr.get('mergeable') is True and pr.get('mergeable_state')=='clean','DEV574_PR')
    head=old.status_dev_github_get('git/commits/'+candidate)
    merge=old.status_dev_github_get('git/commits/'+str(pr.get('merge_commit_sha','')))
    tree=(head.get('tree') or {}).get('sha')
    need(head.get('sha')==candidate and [x.get('sha') for x in head.get('parents',[])]==[BASE]
         and re.fullmatch(r'[0-9a-f]{40}',str(tree or '')) is not None
         and merge.get('sha')==pr.get('merge_commit_sha')
         and [x.get('sha') for x in merge.get('parents',[])]==[BASE,candidate]
         and (merge.get('tree') or {}).get('sha')==tree,'DEV574_MERGE_TREE')
    need(run.get('workflow_id')==329932540 and run.get('head_sha')==candidate and run.get('event')=='pull_request'
         and run.get('run_attempt')==1 and run.get('status')=='completed' and run.get('conclusion')=='success'
         and (run.get('repository') or {}).get('full_name')==REPO and (run.get('head_repository') or {}).get('full_name')==REPO
         and len(run.get('pull_requests') or [])==1 and run['pull_requests'][0].get('number')==pr['number']
         and (run['pull_requests'][0].get('head') or {}).get('sha')==candidate
         and (run['pull_requests'][0].get('base') or {}).get('sha')==BASE,'DEV574_CI')
    jobs=old.status_dev_github_jobs(run['id']); entries=jobs.get('jobs') if isinstance(jobs,dict) else None
    need(isinstance(entries,list) and len(entries)==1 and entries[0].get('conclusion')=='success'
         and any(s.get('name')=='Verify DEV574 exact release contract' and s.get('conclusion')=='success' for s in entries[0].get('steps',[])), 'DEV574_CI_STEP')
    return run['id']


def rollback(env,old):
    expected,account,token=env.get('EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT',''),env.get('CLOUDFLARE_ACCOUNT_ID',''),env.get('CLOUDFLARE_API_TOKEN','')
    need(re.fullmatch(r'[a-f0-9]{64}',expected or '') is not None and re.fullmatch(r'[a-f0-9]{32}',account or '') is not None
         and bool(token) and old.sha256(account.encode('utf-8'))==expected,'DEV574_ACCOUNT')
    result={}
    for name in old.EXPECTED_PROJECTS:
        project=old.legacy_monthly_cloudflare_get(account,token,'pages/projects/'+name).get('result')
        need(isinstance(project,dict) and project.get('name')==name and project.get('production_branch')=='dev'
             and project.get('subdomain')==old.EXPECTED_PROJECT_DOMAINS[name]
             and old.EXPECTED_PROJECT_DOMAINS[name] in (project.get('domains') or [])
             and not any(d in {'tennisnote-app.pages.dev','tennisnote-admin.pages.dev'} for d in (project.get('domains') or [])), 'DEV574_TARGET')
        rows=old.legacy_monthly_cloudflare_get(account,token,'pages/projects/'+name+'/deployments?env=production&per_page=1').get('result')
        need(isinstance(rows,list),'DEV574_ROLLBACK')
        result[name]=old.rollback_proof(name,rows)
        need(result[name]['commit_sha']==BASE,'DEV574_ROLLBACK_SOURCE')
    return old.sha256(json.dumps(result,sort_keys=True,separators=(',',':')).encode())


def live_assets(candidate,opener):
    need(re.fullmatch(r'[0-9a-f]{40}',candidate or '') is not None,'DEV574_LIVE_SHA')
    for url,expected in LIVE_BASE.items():
        try:
            request=urllib.request.Request(url+'?__tn_preflight='+candidate,headers={'Accept':'text/javascript'})
            with opener.open(request,timeout=20) as response:
                need(response.status==200,'DEV574_LIVE_ASSET')
                raw=response.read(2000001)
            need(len(raw)<=2000000,'DEV574_LIVE_ASSET')
            normalized=raw.decode('utf-8').replace('\r\n','\n').rstrip('\n')+'\n'
            need(hashlib.sha256(normalized.encode('utf-8')).hexdigest()==expected,'DEV574_LIVE_ASSET')
        except (OSError,UnicodeError,ValueError):
            raise RuntimeError('DEV574_LIVE_ASSET') from None


def dispatch(args,old):
    env=dict(os.environ)
    need(int(args.source_only)+int(args.live_preflight)==1 and not args.branch_preflight,'DEV574_MODE')
    os.environ['GIT_NO_LAZY_FETCH']='1'
    candidate=context(env,old.run_git('rev-parse','HEAD'),old)
    release=source(candidate,candidate,old); run=ci_result(candidate,old)
    if args.live_preflight:
        old.legacy_monthly_artifacts({'release':release},Path('dist/member-dev'),Path('dist/admin-dev'))
        for built,src in [('dist/member-dev/shared/tennisnote-settlement-adjustment.js','app/shared/tennisnote-settlement-adjustment.js'),
                          ('dist/admin-dev/shared/tennisnote-settlement-adjustment.js','app/shared/tennisnote-settlement-adjustment.js'),
                          ('dist/admin-dev/views/billing.js','app/admin/views/billing.js'),
                          ('dist/member-dev/tennis-note-coach-app/views/settlement.js','app/tennis-note-coach-app/views/settlement.js')]:
            need(digest((ROOT/built).read_bytes())==APP_PINS[src],'DEV574_BUILT_ASSET')
        states=old.read_live_dev_states(candidate)
        for state in states:
            previous=state.get('release') or {}
            need(previous.get('version')=='1.0.573' and previous.get('releaseId')=='2026.11.01.01'
                 and state.get('member_cache')==606 and state.get('coach_cache')==579,'DEV574_LIVE')
        live_assets(candidate,old._LIVE_READ_OPENER)
        old.verify_monotonic_release(release,607,580,states)
        print('DEV574_PREFLIGHT_PASS run_id='+str(run)+' rollback_sha256='+rollback(env,old))
    else:
        print('DEV574_SOURCE_CI_PASS run_id='+str(run))
