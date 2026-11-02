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
BASE = "00569d95246a06aff17035e77eb8027868455760"
SOURCE = "5d545e412db5a768a79ca2c73294d9fdcb533474"
COLLECTOR = "da3b7ab44cd90fa6dc5cbe3daa9142929148992f"
SUPPORT_BASE = SOURCE
FEATURE = "4a950405907b62079fc885e6bcfa9725043c5835"
BRANCH = "codex/tennisnote-admin-review-prod-20261103"
SUBJECT = "release(tennisnote): admin review 565"
SELF = "scripts/check_admin_review_prod565.py"
SELF_SEAL = "c67a3b8d6bee3ba298757c943992d791165e71c4975e83cd568e196d30f60d4d"
SUPPORT_PINS = {
    ".github/workflows/tennisnote-public-ci.yml": "19ecad42bc821522c3d2706c949d0e0b3c55ead9ff46e88e7d92a2176f9a72f8",
    ".github/workflows/deploy-cloudflare-pages.yml": "940855f621d878ff4cbc7aaa04d2ef2812b1372ea69a37fc8ac82270b3354b9e",
    ".github/workflows/deploy-pages.yml": "502e7d2e601119b3b50786b3831006805d57777afdc17368b9ca6c5a80bf7cb6",
    "tests/admin-review-prod565-admission.test.py": "78b78193de9cded8d7cc2902b6de9b49582d6d4e9fb6954e4736f7a218d9f788",
}
PRODUCT = {
    "app/admin/actions/common.js",
    "app/admin/app.js",
    "app/admin/domain/payment.js",
    "app/admin/domain/record.js",
    "app/admin/events/billing.js",
    "app/admin/events/delegated.js",
    "app/admin/index.html",
    "app/admin/views/billing.js",
    "app/admin/views/settings.js",
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
    "scripts/build_cloudflare_pages.py",
    "scripts/verify.sh",
    "tests/admin-brand-assets.test.py",
    "tests/admin-dashboard-repair-context.test.cjs",
    "tests/admin-dashboard-summary.test.cjs",
    "tests/admin-dashboard-task-label.test.cjs"
}
WORKFLOWS = {
    "Tennis Note Public PWA CI": ".github/workflows/tennisnote-public-ci.yml",
    "Deploy Tennis Note short URLs": ".github/workflows/deploy-cloudflare-pages.yml",
    "Deploy Tennis Note web beta": ".github/workflows/deploy-pages.yml",
}


def need(value, code):
    if not value:
        raise RuntimeError("ADMINREVIEW565_" + code)


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
    need(git("show", "-s", "--format=%P", SOURCE) == COLLECTOR
         and git("show", "-s", "--format=%P", COLLECTOR) == FEATURE
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
    need(release.get("version") == release.get("appSurfaceVersion") == "1.0.565"
         and release.get("releaseId") == "2026.11.03.01", "RELEASE")
    for platform in ("android", "ios"):
        need((release.get("nativePlatforms") or {}).get(platform, {}).get("latestVersion") == "1.0.474", "STORE_UNCHANGED")
    for name, expected in (("app/tennis-note-member-app/service-worker.js", "tennis-note-member-pwa-v598"),
                           ("app/tennis-note-coach-app/service-worker.js", "tennis-note-coach-mode-v571")):
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
        raise RuntimeError("ADMINREVIEW565_EVENT")
    return candidate, checkout


def main():
    need(sys.argv[1:] in (["--ci"], ["--deploy"]), "MODE")
    event = json.loads(Path(os.environ["GITHUB_EVENT_PATH"]).read_text(encoding="utf-8"))
    candidate, checkout = validate_context(sys.argv[1][2:], event, dict(os.environ))
    source(candidate, checkout)
    print(json.dumps({"status": "PASS", "scope": "admin_review_prod_565", "database_actions": 0}))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        print(json.dumps({"status": "FAIL", "code": "ADMINREVIEW565_HOLD"}))
        raise SystemExit(1) from None
