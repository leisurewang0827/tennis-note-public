"""Admission and development preflight for the single reviewed dashboard candidate."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = "59fda3615c2c6542d55a6e1597805b94bcbe582e"
SOURCE = "6f679f09f384d2bec866438c1a86b262028f6251"
SUPPORT_BASE = SOURCE
FEATURE = SOURCE
BRANCH = "codex/tennisnote-schedule-count-20261103"
BASE_BRANCH = "codex/tennisnote-admin-review-dev-20261103"
REPO = "leisurewang0827/tennis-note-public"
SELF = "scripts/check_schedule_count_dev577.py"
SELF_SEAL = "46d78826564b3bcc315a8f416ebf9e94fd9871434a5ef80ec8d012ab2d1a0c47"
SUPPORT_PINS = {
    ".github/workflows/tennisnote-public-ci.yml": "c3c9d811fcfdad6e75fa293061db963227ccbee8e9f667693b90cda36fbcdab0",
    "scripts/check_r3_dev_deployment.py": "68d1a53e398dde03c1ec110642039a009a8a1e83a0df8f826b26f83a6b673a97",
    "tests/schedule-count-dev577-admission.test.py": "4dc81561954a18720bef948e483a4b4408e5ca00f15eba941939b4e7c94f0ebc",
}
PRODUCT = {
    "app/admin/index.html",
    "app/admin/schedule-v2-admin.js",
    "app/release.json",
    "app/shared/tennisnote-release.js",
    "app/tennis-note-coach-app/app.js",
    "app/tennis-note-coach-app/domain/coaches.js",
    "app/tennis-note-coach-app/forms/common.js",
    "app/tennis-note-coach-app/index.html",
    "app/tennis-note-coach-app/service-worker.js",
    "app/tennis-note-member-app/app.js",
    "app/tennis-note-member-app/forms/common.js",
    "app/tennis-note-member-app/index.html",
    "app/tennis-note-member-app/service-worker.js",
    "app/tennis-note-member-app/ui/screens.js",
    "tests/admin-holiday-reopen.test.js",
    "tests/admin-schedule-integrity-count.test.js"
}
ADMIN_JS = ("schedule-v2-admin.js",)


def need(condition, code):
    if not condition:
        raise RuntimeError("SCHEDULECOUNT577_" + code)


def digest(data):
    return hashlib.sha256(data.replace(b"\r\n", b"\n")).hexdigest()


def seal(data):
    normalized, count = re.subn(rb'(?m)^SELF_SEAL = "[^"]+"$', b'SELF_SEAL = "PENDING"', data.replace(b"\r\n", b"\n"))
    need(count == 1, "SELF_SHAPE")
    return hashlib.sha256(normalized).hexdigest()


def source(candidate, checkout, old):
    git = old.run_git
    need(re.fullmatch(r"[0-9a-f]{40}", candidate or "") is not None, "CANDIDATE")
    need(git("show", "-s", "--format=%P", candidate) == SUPPORT_BASE
         and git("show", "-s", "--format=%P", SOURCE) == BASE, "GRAPH")
    need(git("rev-parse", "HEAD") == checkout and not git("status", "--porcelain", "--untracked-files=all")
         and not git("diff", "--cached", "--name-only")
         and git("rev-parse", checkout + "^{tree}") == git("rev-parse", candidate + "^{tree}"), "TREE")
    need(set(git("diff", "--name-only", BASE, SOURCE).splitlines()) == PRODUCT, "PRODUCT_SCOPE")
    need(set(git("diff", "--name-only", SOURCE, candidate).splitlines()) == set(SUPPORT_PINS) | {SELF}, "SUPPORT_SCOPE")
    for name, expected in SUPPORT_PINS.items():
        item = ROOT / name
        need(item.is_file() and not item.is_symlink() and re.fullmatch(r"[0-9a-f]{64}", expected or "") is not None
             and digest(item.read_bytes()) == expected, "SUPPORT_PIN")
    need(re.fullmatch(r"[0-9a-f]{64}", SELF_SEAL) is not None and seal((ROOT / SELF).read_bytes()) == SELF_SEAL, "SELF_PIN")
    release = json.loads((ROOT / "app/release.json").read_text(encoding="utf-8"))
    need(release.get("version") == release.get("appSurfaceVersion") == "1.0.577"
         and release.get("releaseId") == "2026.11.03.02", "RELEASE")
    need(old._cache_counter((ROOT / "app/tennis-note-member-app/service-worker.js").read_text(encoding="utf-8"), "tennis-note-member-pwa-") == 610
         and old._cache_counter((ROOT / "app/tennis-note-coach-app/service-worker.js").read_text(encoding="utf-8"), "tennis-note-coach-mode-") == 583, "CACHE")
    return release


def verify_admin_assets(candidate, old):
    for relative in ADMIN_JS:
        source_path = ROOT / "app/admin" / relative
        built_path = ROOT / "dist/admin-dev" / relative
        need(digest(source_path.read_bytes()) == digest(built_path.read_bytes()), "BUILT_ASSET")
        baseline = subprocess.check_output(["git", "show", f"{BASE}:app/admin/{relative}"], cwd=ROOT, timeout=20)
        request = urllib.request.Request("https://tennisnote-admin-dev.pages.dev/" + relative + "?__tn_preflight=" + candidate,
                                         headers={"Cache-Control": "no-cache", "User-Agent": "TennisNote-Release-Preflight/1.0"})
        with old._LIVE_READ_OPENER.open(request, timeout=20) as response:
            need(response.status == 200, "LIVE_ASSET")
            live = response.read(2_000_001)
        need(len(live) <= 2_000_000 and digest(live.rstrip(b"\r\n") + b"\n") == digest(baseline.rstrip(b"\r\n") + b"\n"), "LIVE_ASSET")
    html = (ROOT / "dist/admin-dev/index.html").read_text(encoding="utf-8")
    need('schedule-v2-admin.js?v=schedule-v2-20' in html, "BUILT_HTML")


def ci_pr(event, env, old):
    pr = event.get("pull_request") or {}
    number = event.get("number")
    candidate = (pr.get("head") or {}).get("sha", "")
    merge = env.get("GITHUB_SHA", "")
    need(env.get("GITHUB_EVENT_NAME") == "pull_request" and env.get("GITHUB_REPOSITORY") == REPO
         and env.get("GITHUB_RUN_ATTEMPT") == "1" and env.get("GITHUB_WORKFLOW") == "Tennis Note Public PWA CI"
         and type(number) is int and number > 0 and env.get("GITHUB_REF") == f"refs/pull/{number}/merge"
         and env.get("GITHUB_WORKFLOW_REF") == f"{REPO}/.github/workflows/tennisnote-public-ci.yml@refs/pull/{number}/merge"
         and (pr.get("head") or {}).get("ref") == BRANCH and (pr.get("base") or {}).get("ref") == BASE_BRANCH
         and (pr.get("base") or {}).get("sha") == BASE
         and ((pr.get("head") or {}).get("repo") or {}).get("full_name") == REPO
         and ((pr.get("base") or {}).get("repo") or {}).get("full_name") == REPO
         and old.run_git("rev-parse", "HEAD") == merge
         and old.run_git("show", "-s", "--format=%P", merge) == BASE + " " + candidate, "CI_CONTEXT")
    source(candidate, merge, old)
    return candidate


def ci_receipt(candidate, old):
    rows = old.status_dev_github_get("actions/workflows/tennisnote-public-ci.yml/runs?head_sha=" + candidate + "&event=pull_request&per_page=100").get("workflow_runs")
    need(isinstance(rows, list) and len(rows) == 1, "CI_COUNT")
    run = rows[0]
    links = run.get("pull_requests") or []
    need(run.get("head_sha") == candidate and run.get("event") == "pull_request" and run.get("run_attempt") == 1
         and run.get("status") == "completed" and run.get("conclusion") == "success"
         and run.get("workflow_id") == 329932540 and (run.get("repository") or {}).get("full_name") == REPO
         and (run.get("head_repository") or {}).get("full_name") == REPO and len(links) == 1
         and type(links[0].get("number")) is int
         and (links[0].get("head") or {}).get("sha") == candidate
         and (links[0].get("base") or {}).get("sha") == BASE, "CI_RUN")
    pr = old.status_dev_github_get("pulls/" + str(links[0]["number"]))
    need(pr.get("state") == "open" and pr.get("mergeable") is True and pr.get("mergeable_state") == "clean"
         and (pr.get("head") or {}).get("sha") == candidate and (pr.get("head") or {}).get("ref") == BRANCH
         and (pr.get("base") or {}).get("sha") == BASE and (pr.get("base") or {}).get("ref") == BASE_BRANCH
         and ((pr.get("head") or {}).get("repo") or {}).get("full_name") == REPO
         and ((pr.get("base") or {}).get("repo") or {}).get("full_name") == REPO, "CI_PR")
    head = old.status_dev_github_get("git/commits/" + candidate)
    merge = old.status_dev_github_get("git/commits/" + str(pr.get("merge_commit_sha", "")))
    need(head.get("sha") == candidate and [p.get("sha") for p in head.get("parents", [])] == [SUPPORT_BASE]
         and merge.get("sha") == pr.get("merge_commit_sha")
         and [p.get("sha") for p in merge.get("parents", [])] == [BASE, candidate]
         and (head.get("tree") or {}).get("sha") == (merge.get("tree") or {}).get("sha"), "CI_TREE")
    jobs = old.status_dev_github_jobs(run["id"]).get("jobs")
    need(isinstance(jobs, list) and len(jobs) == 1 and jobs[0].get("conclusion") == "success"
         and any(step.get("name") == "Verify DEV577 schedule count candidate" and step.get("conclusion") == "success" for step in jobs[0].get("steps", [])), "CI_JOB")
    return run["id"]


def rollback(env, old):
    expected, account, token = (env.get(k, "") for k in ("EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT", "CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"))
    need(re.fullmatch(r"[a-f0-9]{64}", expected or "") is not None and re.fullmatch(r"[a-f0-9]{32}", account or "") is not None
         and bool(token) and old.sha256(account.encode("utf-8")) == expected, "ACCOUNT")
    result = {}
    for name in old.EXPECTED_PROJECTS:
        project = old.legacy_monthly_cloudflare_get(account, token, "pages/projects/" + name).get("result")
        domain = old.EXPECTED_PROJECT_DOMAINS[name]
        need(isinstance(project, dict) and project.get("name") == name and project.get("production_branch") == "dev"
             and project.get("subdomain") == domain and domain in (project.get("domains") or [])
             and not any(d in {"tennisnote-app.pages.dev", "tennisnote-admin.pages.dev"} for d in (project.get("domains") or [])), "TARGET")
        rows = old.legacy_monthly_cloudflare_get(account, token, "pages/projects/" + name + "/deployments?env=production&per_page=1").get("result")
        need(isinstance(rows, list), "ROLLBACK")
        result[name] = old.rollback_proof(name, rows)
        need(result[name]["commit_sha"] == BASE, "ROLLBACK_SOURCE")
    return old.sha256(json.dumps(result, sort_keys=True, separators=(",", ":")).encode())


def dispatch(args, old):
    env = dict(os.environ)
    candidate = env.get("TENNISNOTE_CANDIDATE_SHA", "")
    need(int(args.source_only) + int(args.live_preflight) == 1 and not args.branch_preflight
         and env.get("GITHUB_EVENT_NAME") == "workflow_dispatch" and env.get("GITHUB_REPOSITORY") == REPO
         and env.get("GITHUB_REF") == "refs/heads/" + BRANCH and env.get("GITHUB_REF_TYPE") == "branch"
         and env.get("GITHUB_WORKFLOW") == "Deploy Tennis Note development sites" and env.get("GITHUB_RUN_ATTEMPT") == "1"
         and env.get("TENNISNOTE_WORKFLOW_REF") == REPO + "/.github/workflows/deploy-cloudflare-pages-dev.yml@refs/heads/" + BRANCH
         and candidate == env.get("GITHUB_SHA") == old.run_git("rev-parse", "HEAD"), "CONTEXT")
    release = source(candidate, candidate, old)
    run_id = ci_receipt(candidate, old)
    if args.live_preflight:
        old.legacy_monthly_artifacts({"release": release}, Path("dist/member-dev"), Path("dist/admin-dev"))
        verify_admin_assets(candidate, old)
        states = old.read_live_dev_states(candidate)
        need(len(states) == 2 and all((s.get("release") or {}).get("version") == "1.0.576"
             and (s.get("release") or {}).get("releaseId") == "2026.11.03.01"
             and s.get("member_cache") == 609 and s.get("coach_cache") == 582 for s in states), "LIVE_BASE")
        old.verify_monotonic_release(release, 610, 583, states)
        print("SCHEDULECOUNT577_PREFLIGHT_PASS run_id=" + str(run_id) + " rollback_sha256=" + rollback(env, old))
    else:
        print("SCHEDULECOUNT577_SOURCE_CI_PASS run_id=" + str(run_id))
