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
BASE = "905e8b65d5fa540f7d410e6b0255587f566d68dd"
SOURCE = "70669f94d903e1e02a15613222346923cfa1466e"
SUPPORT_BASE = SOURCE
FEATURE = SOURCE
BRANCH = "codex/tennisnote-schedule-integrity-prod-20261103"
SUBJECT = "release(tennisnote): schedule integrity 566"
SELF = "scripts/check_schedule_integrity_prod566.py"
SELF_SEAL = "a3a72c2bdb9677b20195d6bcbc8d80805f1bb1e6831550fea4eb7049c3cd9b2c"
SUPPORT_PINS = {
    ".github/workflows/tennisnote-public-ci.yml": "bb55f491444afe63abc4f1e8b53632ce348fc2dd94f5a194955c20329f5df4dd",
    ".github/workflows/deploy-cloudflare-pages.yml": "8ae44be47b0b93ba564a28250f43ab79206b7ace6f526bbe536785ad0569d1df",
    ".github/workflows/deploy-pages.yml": "5b92f419fa96ad5b5623e34f1f9970c576835012698bac5a0d5ae1236db2d936",
    "tests/schedule-integrity-prod566-admission.test.py": "fcec10c2e5d73b10cb9a38fb1abc83d1b460014d8403ea410fca441f4c86c1c4",
}
PRODUCT = {
    "app/admin/app.js",
    "app/admin/events/schedule.js",
    "app/admin/index.html",
    "app/admin/schedule-v2-admin.js",
    "app/release.json",
    "app/shared/tennisnote-data-client.js",
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
    "tests/admin-schedule-integrity-count.test.js",
    "tests/admin-schedule-integrity-wiring.test.cjs"
}
WORKFLOWS = {
    "Tennis Note Public PWA CI": ".github/workflows/tennisnote-public-ci.yml",
    "Deploy Tennis Note short URLs": ".github/workflows/deploy-cloudflare-pages.yml",
    "Deploy Tennis Note web beta": ".github/workflows/deploy-pages.yml",
}


def need(value, code):
    if not value:
        raise RuntimeError("SCHEDULEINTEGRITY566_" + code)


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
    need(git("show", "-s", "--format=%P", SOURCE) == BASE, "SOURCE_GRAPH")
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
    need(release.get("version") == release.get("appSurfaceVersion") == "1.0.566"
         and release.get("releaseId") == "2026.11.03.02", "RELEASE")
    for platform in ("android", "ios"):
        need((release.get("nativePlatforms") or {}).get(platform, {}).get("latestVersion") == "1.0.474", "STORE_UNCHANGED")
    for name, expected in (("app/tennis-note-member-app/service-worker.js", "tennis-note-member-pwa-v599"),
                           ("app/tennis-note-coach-app/service-worker.js", "tennis-note-coach-mode-v572")):
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
             and git("show", "-s", "--format=%P", candidate) == SUPPORT_BASE
             and git("show", "-s", "--format=%P", checkout) == BASE + " " + candidate, "PR")
    elif env.get("GITHUB_EVENT_NAME") == "push":
        candidate = checkout
        need(ref == "refs/heads/main" and event.get("before") == BASE
             and (event.get("head_commit") or {}).get("message", "").startswith(SUBJECT)
             and git("show", "-s", "--format=%P", checkout) == BASE
             and ((mode == "ci" and workflow == WORKFLOWS["Tennis Note Public PWA CI"])
                  or (mode == "deploy" and workflow in (WORKFLOWS["Deploy Tennis Note short URLs"], WORKFLOWS["Deploy Tennis Note web beta"]))), "PUSH")
    else:
        raise RuntimeError("SCHEDULEINTEGRITY566_EVENT")
    return candidate, checkout


def main():
    need(sys.argv[1:] in (["--ci"], ["--deploy"]), "MODE")
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    candidate, checkout = validate_context(sys.argv[1][2:], event, dict(os.environ))
    source(candidate, checkout)
    print(json.dumps({"status": "PASS", "scope": "schedule_integrity_prod_566", "database_actions": 0}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(json.dumps({"status": "FAIL", "code": "SCHEDULEINTEGRITY566_HOLD"}))
        raise SystemExit(1) from None
