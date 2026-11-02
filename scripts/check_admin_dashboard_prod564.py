"""Admission for the single reviewed 1.0.564 administrator dashboard candidate."""
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
REPO = "leisurewang0827/tennis-note-public"
BASE = "7b8310d137c19d7a8ac2b828de32f2e24e6c7d83"
SOURCE = "2762864991e3e00c92586b334b89830287f054f3"
FEATURE = "013316fb76ab6cca4c77f9ce8917411122e5cc57"
BRANCH = "codex/tennisnote-admin-dashboard-prod-20261102"
SUBJECT = "release(tennisnote): admin dashboard 564"
SELF = "scripts/check_admin_dashboard_prod564.py"
SELF_SEAL = "cde11dd992f80a50254b60cb006a96b5463b2619328d0337eee6fca56f4c6758"
SUPPORT_PINS = {
    ".github/workflows/tennisnote-public-ci.yml": "69e2bfc5c69eeaa6b29b9250ae685b349eda8608fea8273d0fc1f7c633b12856",
    ".github/workflows/deploy-cloudflare-pages.yml": "506eaa41848e9f0084c019c15ace8b312e5801e49ac723a78f44d5a165909874",
    ".github/workflows/deploy-pages.yml": "478b0d40b3e5c0855553be7ef5cce4c5b5694bcb9ae90942340a62574f6d4f39",
    "scripts/verify.sh": "2e1bbd107d12c76c986f1187374ae3f813964ac95891e7948fccbb8793767fc1",
    "tests/admin-dashboard-prod564-admission.test.py": "002fed72cd0fbe916b23ee626217168bfb6eeef9bfc245d8c98c73487e90a68f",
}
PRODUCT = {
    "app/admin/actions/common.js", "app/admin/actions/settings.js", "app/admin/catalog.js",
    "app/admin/domain/policy.js", "app/admin/events/delegated.js", "app/admin/index.html",
    "app/admin/views/common.js", "app/admin/views/settings.js", "app/release.json",
    "app/shared/tennisnote-release.js", "app/tennis-note-coach-app/app.js",
    "app/tennis-note-coach-app/domain/coaches.js", "app/tennis-note-coach-app/forms/common.js",
    "app/tennis-note-coach-app/index.html", "app/tennis-note-coach-app/service-worker.js",
    "app/tennis-note-member-app/app.js", "app/tennis-note-member-app/forms/common.js",
    "app/tennis-note-member-app/index.html", "app/tennis-note-member-app/service-worker.js",
    "app/tennis-note-member-app/ui/screens.js", "tests/admin-dashboard-summary.test.cjs",
}
WORKFLOWS = {
    "Tennis Note Public PWA CI": ".github/workflows/tennisnote-public-ci.yml",
    "Deploy Tennis Note short URLs": ".github/workflows/deploy-cloudflare-pages.yml",
    "Deploy Tennis Note web beta": ".github/workflows/deploy-pages.yml",
}


def need(value, code):
    if not value:
        raise RuntimeError("DASHBOARD564_" + code)


def digest(data):
    return hashlib.sha256(data.replace(b"\r\n", b"\n")).hexdigest()


def seal(data):
    normalized, count = re.subn(rb'(?m)^SELF_SEAL = "[^"]+"$', b'SELF_SEAL = "PENDING"', data.replace(b"\r\n", b"\n"))
    need(count == 1, "SELF_SHAPE")
    return hashlib.sha256(normalized).hexdigest()


def git(*args):
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True, encoding="utf-8", stderr=subprocess.DEVNULL, timeout=20).strip()


def source(candidate, checkout):
    need(re.fullmatch(r"[0-9a-f]{40}", candidate or "") is not None, "CANDIDATE")
    need(git("rev-parse", "HEAD") == checkout and not git("status", "--porcelain", "--untracked-files=all")
         and not git("diff", "--cached", "--name-only")
         and git("rev-parse", checkout + "^{tree}") == git("rev-parse", candidate + "^{tree}"), "TREE")
    need(git("show", "-s", "--format=%P", SOURCE) == FEATURE
         and git("show", "-s", "--format=%P", FEATURE) == BASE, "SOURCE_GRAPH")
    need(set(git("diff", "--name-only", BASE, SOURCE).splitlines()) == PRODUCT, "PRODUCT_SCOPE")
    need(set(git("diff", "--name-only", BASE, candidate).splitlines()) == PRODUCT | set(SUPPORT_PINS) | {SELF}, "CANDIDATE_SCOPE")
    for name in PRODUCT:
        need(git("rev-parse", f"{candidate}:{name}") == git("rev-parse", f"{SOURCE}:{name}"), "PRODUCT_PIN")
    for name, expected in SUPPORT_PINS.items():
        item = ROOT / name
        need(item.is_file() and not item.is_symlink() and re.fullmatch(r"[0-9a-f]{64}", expected or "") is not None
             and digest(item.read_bytes()) == expected, "SUPPORT_PIN")
    need(re.fullmatch(r"[0-9a-f]{64}", SELF_SEAL) is not None and seal((ROOT / SELF).read_bytes()) == SELF_SEAL, "SELF_PIN")
    release = json.loads((ROOT / "app/release.json").read_text(encoding="utf-8"))
    need(release.get("version") == release.get("appSurfaceVersion") == "1.0.564"
         and release.get("releaseId") == "2026.11.02.03", "RELEASE")
    for platform in ("android", "ios"):
        need((release.get("nativePlatforms") or {}).get(platform, {}).get("latestVersion") == "1.0.474", "STORE_UNCHANGED")
    for name, expected in (("app/tennis-note-member-app/service-worker.js", "tennis-note-member-pwa-v597"),
                           ("app/tennis-note-coach-app/service-worker.js", "tennis-note-coach-mode-v570")):
        need(f'const CACHE_NAME = "{expected}";' in (ROOT / name).read_text(encoding="utf-8"), "CACHE")


def validate_context(mode, event, env):
    workflow = WORKFLOWS.get(env.get("GITHUB_WORKFLOW"))
    ref = env.get("GITHUB_REF", "")
    need(env.get("GITHUB_REPOSITORY") == REPO and env.get("GITHUB_RUN_ATTEMPT") == "1" and workflow
         and env.get("GITHUB_WORKFLOW_REF") == f"{REPO}/{workflow}@{ref}", "CONTEXT")
    checkout = env.get("GITHUB_SHA", "")
    need(re.fullmatch(r"[0-9a-f]{40}", checkout or "") is not None, "SHA")
    if env.get("GITHUB_EVENT_NAME") == "pull_request":
        pr = event.get("pull_request") or {}
        candidate = (pr.get("head") or {}).get("sha", "")
        n = event.get("number")
        need(mode == "ci" and workflow == WORKFLOWS["Tennis Note Public PWA CI"]
             and type(n) is int and n > 0 and ref == f"refs/pull/{n}/merge"
             and (pr.get("head") or {}).get("ref") == BRANCH and (pr.get("base") or {}).get("ref") == "main"
             and (pr.get("base") or {}).get("sha") == BASE
             and ((pr.get("head") or {}).get("repo") or {}).get("full_name") == REPO
             and ((pr.get("base") or {}).get("repo") or {}).get("full_name") == REPO
             and git("show", "-s", "--format=%P", candidate) == SOURCE
             and git("show", "-s", "--format=%P", checkout) == BASE + " " + candidate, "PR")
    elif env.get("GITHUB_EVENT_NAME") == "push":
        candidate = checkout
        need(ref == "refs/heads/main" and event.get("before") == BASE
             and (event.get("head_commit") or {}).get("message", "").startswith(SUBJECT)
             and git("show", "-s", "--format=%P", checkout) == BASE
             and ((mode == "ci" and workflow == WORKFLOWS["Tennis Note Public PWA CI"])
                  or (mode == "deploy" and workflow in (WORKFLOWS["Deploy Tennis Note short URLs"], WORKFLOWS["Deploy Tennis Note web beta"]))), "PUSH")
    else:
        raise RuntimeError("DASHBOARD564_EVENT")
    return candidate, checkout


def main():
    need(sys.argv[1:] in (["--ci"], ["--deploy"]), "MODE")
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    candidate, checkout = validate_context(sys.argv[1][2:], event, dict(os.environ))
    source(candidate, checkout)
    print(json.dumps({"status": "PASS", "scope": "dashboard_prod_564", "database_actions": 0}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(json.dumps({"status": "FAIL", "code": "DASHBOARD564_HOLD"}))
        raise SystemExit(1) from None
