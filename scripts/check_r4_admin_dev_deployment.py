"""Local review candidate for the exact R4 admin-only development route."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys
import urllib.request

REPO = "leisurewang0827/tennis-note-public"
BRANCH = "codex/tennisnote-r4-admin-dev-20261104"
BASE = "15f046722252a75892886ca7afd67a4fea37ea9f"
REVIEWED_PARENT = "692f532b69cbc332d3aa17aa26eaccaf5e4ecbd4"
PROJECT = "tennisnote-admin-dev"
PRIOR_URL = "https://5c75dcf7.tennisnote-admin-dev.pages.dev"
PRIOR_DEPLOYMENT = "5c75dcf7-fcc3-4203-94d7-aaa699d31a52"
VERSION = "1.0.582"
RELEASE_ID = "2026.11.04.04"
FINGERPRINT = "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba"
WORKFLOW = ".github/workflows/deploy-cloudflare-pages-dev.yml"
CI_WORKFLOW = ".github/workflows/tennisnote-public-ci.yml"
BASE_BRANCH = "codex/tennisnote-schedule-integrity-dev-20261103"
FILES = {
    ".github/workflows/deploy-cloudflare-pages-dev.yml",
    ".github/workflows/tennisnote-public-ci.yml",
    "app/admin/actions/common.js",
    "app/admin/index.html",
    "app/admin/r4-branch-admin-writes.js",
    "app/admin/r4-branch-hours.js",
    "app/admin/r4-branch-operations.js",
    "app/admin/r4-onboarding.js",
    "app/admin/views/settings.js",
    "app/release.json",
    "scripts/build_cloudflare_pages.py",
    "scripts/check_r4_admin_dev_deployment.py",
}
FOLLOWUP_FILES = {
    "app/admin/index.html",
    "app/admin/r4-branch-admin-writes.js",
    "app/admin/r4-branch-operations.js",
    "app/admin/views/settings.js",
    "app/release.json",
    "scripts/check_r4_admin_dev_deployment.py",
}
ASSETS = {
    "app/admin/index.html": "445bd368ac144081a4e2957c7b1c3ef1b305be248c0c2371aafc7bbdf0ee5ee4",
    "app/admin/views/settings.js": "93a1130f2a3010a7b81f51d4212459435d7576bc8e885c6ea4987eb7a2e7fea3",
    "app/admin/r4-branch-hours.js": "811f3c7b990c2b48ecf6ebc982eeca744f9999a2987be2bc12d0b675b211fd0b",
    "app/admin/r4-branch-admin-writes.js": "8b124453005072e06d5f524dbf1e7b3a92ab3e2da137a3b52460e8774fa66d1f",
    "app/admin/r4-onboarding.js": "89e3375f914569cac32998b42f6339494be6ce1a41ab501adde0224bfd4bfb5d",
    "app/admin/actions/common.js": "b6ae4f530368777788b4abe313719a3037a859de8c7b23a0b486b4bc729d36a5",
    "app/admin/r4-branch-operations.js": "1ae64393eae9a960248b50478861508a5cf88f17e38d26e06e7e5fd890bb969b"
}

def need(condition, reason):
    if not condition:
        raise ValueError(reason)

def sha(value):
    return hashlib.sha256(value).hexdigest()

def git(*args):
    return subprocess.check_output(["git", *args], timeout=12)

def revision(value):
    return isinstance(value, str) and re.fullmatch(r"[0-9a-f]{40}", value) is not None

def check_source(env):
    target = env.get("TENNISNOTE_CANDIDATE_SHA", "")
    need(revision(target) and target == env.get("GITHUB_SHA"), "CANDIDATE_SHA")
    need(env.get("GITHUB_EVENT_NAME") == "workflow_dispatch"
         and env.get("GITHUB_REPOSITORY") == REPO and env.get("GITHUB_REF") == "refs/heads/" + BRANCH
         and env.get("GITHUB_RUN_ATTEMPT") == "1"
         and env.get("TENNISNOTE_WORKFLOW_REF") == f"{REPO}/{WORKFLOW}@refs/heads/{BRANCH}", "EXECUTION_SCOPE")
    return check_candidate(env, target)

def check_ci_source(env, event):
    pr = event.get("pull_request") or {}
    head, base = pr.get("head") or {}, pr.get("base") or {}
    target = head.get("sha")
    need(env.get("GITHUB_EVENT_NAME") == "pull_request" and env.get("GITHUB_REPOSITORY") == REPO
         and pr.get("number") == 240
         and env.get("GITHUB_RUN_ATTEMPT") == "1" and env.get("GITHUB_HEAD_REF") == BRANCH
         and env.get("GITHUB_BASE_REF") == BASE_BRANCH and head.get("ref") == BRANCH
         and base.get("ref") == BASE_BRANCH and base.get("sha") == BASE
         and (head.get("repo") or {}).get("full_name") == (base.get("repo") or {}).get("full_name") == REPO
         and revision(target), "CI_EXECUTION_SCOPE")
    return check_candidate(env, target)

def check_candidate(env, target):
    need(git("rev-parse", "HEAD").decode().strip() == target, "HEAD")
    need(git("rev-parse", "HEAD^").decode().strip() == REVIEWED_PARENT
         and git("rev-parse", "HEAD^^^^").decode().strip() == BASE, "PARENT")
    need(len(git("rev-list", "--parents", "-n", "1", "HEAD").split()) == 2, "PARENT_COUNT")
    need(not git("status", "--porcelain", "--untracked-files=all").strip(), "DIRTY")
    paths = set(git("diff", "--no-renames", "--name-only", BASE, target).decode().splitlines())
    need(paths == FILES, "EXACT_PATHS")
    need(set(git("diff", "--no-renames", "--name-only", REVIEWED_PARENT, target).decode().splitlines())
         == FOLLOWUP_FILES, "EXACT_FOLLOWUP_PATHS")
    need(sha(git("show", f"{target}:scripts/build_cloudflare_pages.py"))
         == "af64d2fdd0b581b59881934c814b4f0854f5741c1684f8cb93b89e61661c7222", "BUILDER_DIGEST")
    for path, expected in ASSETS.items():
        need(sha(git("show", f"{target}:{path}")) == expected, "ASSET_DIGEST")
    need(env.get("TENNISNOTE_ENVIRONMENT") == "development"
         and env.get("TENNISNOTE_PAYMENTS_ENABLED") == "false"
         and env.get("TENNISNOTE_PAYMENT_MODE") == "disabled"
         and env.get("TENNISNOTE_BANK_TRANSFER_ENABLED") == "false"
         and env.get("TENNISNOTE_SUPABASE_URL") == "https://udjmiezroipctytmztwz.supabase.co", "DEV_RUNTIME")
    old = json.loads(git("show", BASE+":app/release.json"))
    new = json.loads(git("show", target+":app/release.json"))
    allowed = {"version", "releaseId", "appSurfaceVersion", "deployedAt"}
    need(set(new) == set(old) and all(new[k] == old[k] for k in old.keys()-allowed), "RELEASE_METADATA_SCOPE")
    need(new["version"] == VERSION and new["appSurfaceVersion"] == VERSION
         and new["releaseId"] == RELEASE_ID, "RELEASE_ORDER")
    return target

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *_args, **_kwargs):
        raise ValueError("UNEXPECTED_REDIRECT")

def read_json(url, token=""):
    headers = {"Accept": "application/json", "User-Agent": "TennisNote-R4-Admin-Dev"}
    if token:
        headers["Authorization"] = "Bearer " + token
    with urllib.request.build_opener(NoRedirect()).open(urllib.request.Request(url, headers=headers), timeout=15) as response:
        raw = response.read(2_000_001)
    need(len(raw) <= 2_000_000, "RESPONSE_SIZE")
    return json.loads(raw)

def verify_ci(get, run_id, target):
    need(re.fullmatch(r"[1-9][0-9]*", run_id), "CI_ID")
    run = get(f"actions/runs/{run_id}")
    need(run.get("path") == ".github/workflows/tennisnote-public-ci.yml"
         and run.get("workflow_id") == 329932540
         and run.get("head_sha") == target and run.get("head_branch") == BRANCH
         and run.get("event") == "pull_request" and run.get("run_attempt") == 1
         and run.get("status") == "completed" and run.get("conclusion") == "success"
         and (run.get("head_repository") or {}).get("full_name") == REPO, "CI_RECEIPT")
    prs = run.get("pull_requests") or []
    need(len(prs) == 1 and prs[0].get("number") == 240, "CI_PR")
    pr = get(f"pulls/{prs[0]['number']}")
    need(pr.get("state") == "open" and (pr.get("head") or {}).get("sha") == target and (pr.get("base") or {}).get("sha") == BASE
         and ((pr.get("base") or {}).get("repo") or {}).get("full_name") == REPO, "PR_PIN")
    verify_focused_job(get(f"actions/runs/{run_id}/jobs?per_page=100"))

def verify_focused_job(receipt):
    jobs = receipt.get("jobs")
    need(isinstance(jobs, list) and receipt.get("total_count") == len(jobs) and len(jobs) <= 2, "CI_JOB_COUNT")
    focus = [job for job in jobs if job.get("name") == "verify-r4-admin-only"]
    need(len(focus) == 1 and focus[0].get("conclusion") == "success"
         and any(step.get("name") == "Build and verify only the R4 development administrator web"
                 and step.get("conclusion") == "success" for step in (focus[0].get("steps") or []))
         and all(job.get("conclusion") == "skipped" for job in jobs if job.get("name") != "verify-r4-admin-only"), "CI_FOCUSED_JOB")

def verify_recovery(project, rows, active, immutable):
    need(project.get("name") == PROJECT and project.get("production_branch") == "dev", "CF_PROJECT")
    need(isinstance(rows, list) and len(rows) == 1, "CF_RESULT")
    deploy = rows[0]
    meta = (deploy.get("deployment_trigger") or {}).get("metadata") or {}
    need(deploy.get("environment") == "production" and meta.get("branch") == "dev"
         and meta.get("commit_hash") == REVIEWED_PARENT and (deploy.get("latest_stage") or {}).get("status") == "success"
         and deploy.get("url") == PRIOR_URL
         and PRIOR_DEPLOYMENT != "UNBOUND_BLOCK_DEPLOYMENT"
         and deploy.get("id") == PRIOR_DEPLOYMENT, "CF_RECOVERY")
    for manifest in [active, immutable]:
        need(manifest.get("version") == "1.0.581" and manifest.get("releaseId") == "2026.11.04.03", "LIVE_RELEASE")
    need(active == immutable, "LIVE_RELEASE_CONTENT")
    return deploy["id"]

def verify_artifact(root, target):
    config = (root/"shared/config.local.js").read_text(encoding="utf-8")
    app_prefix, payment_prefix = "window.TENNISNOTE_CONFIG = ", "window.TENNIS_NOTE_PAYMENT_CONFIG = "
    parts = config.split(";\n\n"+payment_prefix)
    need(len(parts) == 2 and parts[0].startswith(app_prefix) and parts[1].endswith(";\n"), "BUILT_CONFIG_FORMAT")
    app = json.loads(parts[0][len(app_prefix):])
    payment = json.loads(parts[1][:-2])
    need(app.get("environment") == "development" and app.get("projectFingerprint") == FINGERPRINT
         and payment.get("enabled") is False and payment.get("mode") == "disabled"
         and (payment.get("bankTransfer") or {}).get("enabled") is False, "BUILT_CONFIG")
    index = git("show", target+":app/admin/index.html").decode()
    index = index.replace("../tennis-note-member-app/assets/brand/app-icon-", "./assets/brand/app-icon-")
    if 'name="robots"' not in index:
        index = index.replace("</head>", '  <meta name="robots" content="noindex,nofollow" />\n</head>', 1)
    built = (root/"index.html").read_text(encoding="utf-8")
    banner = r'\n    <aside role="status" aria-label="개발계 안내" style="[^"<>]*">개발계 · 실제 결제·푸시 차단</aside>'
    stripped, count = re.subn(banner, "", built)
    need(count == 1 and stripped == index, "BUILT_HTML")
    for asset, expected in ASSETS.items():
        if asset != "app/admin/index.html":
            need(sha((root/asset.removeprefix("app/admin/")).read_bytes()) == expected, "BUILT_ASSET")
    release = json.loads((root/"release.json").read_text(encoding="utf-8"))
    need(release == json.loads(git("show", f"{target}:app/release.json"))
         and release.get("version") == VERSION and release.get("releaseId") == RELEASE_ID, "BUILT_RELEASE")
    built_labels = (root/"shared/tennisnote-release.js").read_text(encoding="utf-8")
    template = git("show", f"{BASE}:app/shared/tennisnote-release.js").decode()
    for key in ("version", "releaseId", "appSurfaceVersion", "deployedAt"):
        template, n = re.subn(rf'^    {key}: "[^"\n]*",$',
                              lambda _: f"    {key}: {json.dumps(release[key])},", template, flags=re.M)
        need(n == 1, "RELEASE_LABEL_TEMPLATE")
    need(built_labels == template, "BUILT_RELEASE_LABELS")

def main():
    target = check_source(os.environ)
    verify_artifact(Path("dist/admin-dev"), target)
    github = lambda path: read_json(f"https://api.github.com/repos/{REPO}/{path}", os.environ["STATUS_GITHUB_TOKEN"])
    verify_ci(github, os.environ.get("TENNISNOTE_CI_RUN_ID",""), target)
    account = os.environ.get("CLOUDFLARE_ACCOUNT_ID","")
    need(re.fullmatch(r"[a-f0-9]{32}",account) and sha(account.encode()) ==
         os.environ.get("EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT"), "CF_ACCOUNT")
    cf = "https://api.cloudflare.com/client/v4/accounts/"+account+"/pages/projects/"+PROJECT
    token = os.environ["CLOUDFLARE_API_TOKEN"]
    project = read_json(cf, token)
    deployments = read_json(cf+"/deployments?env=production&per_page=1",token)
    need(project.get("success") is True and deployments.get("success") is True, "CF_API")
    recovery = verify_recovery(project.get("result"), deployments.get("result"),
                               read_json("https://"+PROJECT+".pages.dev/release.json"), read_json(PRIOR_URL+"/release.json"))
    print(json.dumps({"candidate":target,"adminProject":PROJECT,"rollbackDeployment":recovery}))

if __name__ == "__main__":
    try:
        if sys.argv[1:] == ["--ci"]:
            with open(os.environ["GITHUB_EVENT_PATH"], encoding="utf-8") as stream:
                candidate = check_ci_source(os.environ, json.load(stream))
            verify_artifact(Path("dist/admin-dev"), candidate)
            print("R4 admin-only source and DEV artifact checks passed")
        else:
            need(not sys.argv[1:], "ARGUMENTS")
            main()
    except Exception as exc:
        print("R4 admin deployment denied: " + (str(exc) if isinstance(exc, ValueError) and re.fullmatch(r"[A-Z_]+", str(exc)) else "PREFLIGHT_FAILED"), file=sys.stderr)
        raise SystemExit(1) from None
