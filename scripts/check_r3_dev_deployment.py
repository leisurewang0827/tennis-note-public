#!/usr/bin/env python3
"""Fail-closed source, runtime, and rollback preflight for the exact R3 dev deploy."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTRACT_PATH = ROOT / "tests/fixtures/r3-production-promotion.json"
CACHE_FLOOR_CONTRACT_PATH = ROOT / "tests/fixtures/r3-dev-cache-floors.json"
EXPECTED_BASE = "686cc97d9676da2d16ca3cdfbd862dc9cd19434e"
EXPECTED_BRANCH = "codex/tennisnote-r3-prod-promotion-20261021"
EXPECTED_REPOSITORY = "leisurewang0827/tennis-note-public"
EXPECTED_WORKFLOW_REF = f"{EXPECTED_REPOSITORY}/.github/workflows/deploy-cloudflare-pages-dev.yml@refs/heads/{EXPECTED_BRANCH}"
EXPECTED_WORKFLOW_NAME = "Deploy Tennis Note development sites"
EXPECTED_VERSION = "1.0.553"
EXPECTED_RELEASE_ID = "2026.10.21.01"
CACHE_FLOOR_CONTRACT = json.loads(CACHE_FLOOR_CONTRACT_PATH.read_text(encoding="utf-8"))
EXPECTED_MEMBER_CACHE = max(CACHE_FLOOR_CONTRACT["development"]["member"], CACHE_FLOOR_CONTRACT["production"]["member"]) + 1
EXPECTED_COACH_CACHE = max(CACHE_FLOOR_CONTRACT["development"]["coach"], CACHE_FLOOR_CONTRACT["production"]["coach"]) + 1
EXPECTED_CACHE_FLOORS = {
    "development": {
        "source": "8406c9a70ee4299e60a0c5a2a536040d116fe3f0",
        "member": 588,
        "coach": 561,
        "memberSourceSha256": "eaecc1146d63c0321e67152ba7baf639f82828e699bca5bab7880977038d5f78",
        "coachSourceSha256": "86f70f7ee7815fc1c2bbbe7db76825846d8b4caa2e4dd8efcc90ec8e19c44630",
    },
    "production": {
        "source": EXPECTED_BASE,
        "member": 564,
        "coach": 537,
        "memberSourceSha256": "4917794c174a2ab6fe54d61a52830d23008145c3d0efcc83a942845d6d87a7e8",
        "coachSourceSha256": "22de0462978fb2ec7ebf334a362f909e85340a3fb7728b20290117df9440eb43",
    },
}
EXPECTED_PROJECTS = ("tennisnote-admin-dev", "tennisnote-app-dev")
EXPECTED_DEV_PROJECT_FINGERPRINT = "63350140ffe50d07136f3e5a27f66a20266c84ebf02987f536949c9a400ebcba"
EXPECTED_DEV_PROJECT_PREFIX = "63350140ffe5"
EXPECTED_PROJECT_DOMAINS = {
    "tennisnote-admin-dev": "tennisnote-admin-dev.pages.dev",
    "tennisnote-app-dev": "tennisnote-app-dev.pages.dev",
}
DEV_MEMBER_ORIGIN = "https://tennisnote-app-dev.pages.dev"
DEV_ADMIN_ORIGIN = "https://tennisnote-admin-dev.pages.dev"
EXPECTED_REMOVED_PATH = "app/shared/tennisnote-settlement-adjustment.js"
SHA256_RE = re.compile(r"^[0-9a-f]{64}$")
SHA40_RE = re.compile(r"^[0-9a-f]{40}$")
CF_DEPLOYMENT_ID_RE = re.compile(r"^[0-9a-f-]{36}$")


def fail(message: str) -> None:
    raise RuntimeError(message)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def normalize_text(data: bytes) -> bytes:
    return data.decode("utf-8").replace("\r\n", "\n").encode("utf-8")


def load_contract() -> dict[str, object]:
    contract = json.loads(CONTRACT_PATH.read_text(encoding="utf-8"))
    if set(contract) != {"base", "files"} or contract["base"] != EXPECTED_BASE:
        fail("R3 source manifest schema/base mismatch")
    files = contract["files"]
    if not isinstance(files, list) or len(files) != 35:
        fail("R3 source manifest must contain exactly 35 paths")
    paths: list[str] = []
    removed: set[str] = set()
    for item in files:
        if set(item) != {"path", "baseSha256", "candidateSha256"}:
            fail("R3 source manifest row schema mismatch")
        path = item["path"]
        if not isinstance(path, str) or not path.startswith("app/") or ".." in Path(path).parts:
            fail("R3 source manifest path invalid")
        paths.append(path)
        base_sha = item["baseSha256"]
        if base_sha is None:
            removed.add(path)
        elif not isinstance(base_sha, str) or not SHA256_RE.fullmatch(base_sha):
            fail("R3 base content hash invalid")
        candidate_sha = item["candidateSha256"]
        if not isinstance(candidate_sha, str) or not SHA256_RE.fullmatch(candidate_sha):
            fail("R3 candidate content hash invalid")
    if len(paths) != len(set(paths)):
        fail("R3 source manifest contains duplicate paths")
    if removed != {EXPECTED_REMOVED_PATH}:
        fail("R3 additive source path set mismatch")
    return contract


def validate_dispatch_context(
    *, event_name: str, ref: str, ref_type: str, workflow_ref: str,
    workflow_name: str, candidate_sha: str, github_sha: str, head_sha: str,
) -> None:
    if event_name != "workflow_dispatch":
        fail("manual deployment requires workflow_dispatch")
    if ref_type != "branch" or ref != f"refs/heads/{EXPECTED_BRANCH}":
        fail("manual deployment ref is not the reviewed candidate branch")
    if workflow_ref != EXPECTED_WORKFLOW_REF or workflow_name != EXPECTED_WORKFLOW_NAME:
        fail("manual deployment caller workflow mismatch")
    if not SHA40_RE.fullmatch(candidate_sha) or candidate_sha != github_sha or github_sha != head_sha:
        fail("reviewed candidate SHA does not match the checked-out commit")


def run_git(*args: str) -> str:
    return subprocess.check_output(["git", *args], cwd=ROOT, text=True, encoding="utf-8").strip()


def verify_source(candidate_sha: str) -> dict[str, object]:
    contract = load_contract()
    validate_cache_floor_provenance()
    if not SHA40_RE.fullmatch(candidate_sha) or run_git("rev-parse", "HEAD") != candidate_sha:
        fail("checked-out source is not the explicit candidate SHA")
    run_git("merge-base", "--is-ancestor", EXPECTED_BASE, candidate_sha)
    expected = {row["path"] for row in contract["files"]}
    changed = set(filter(None, run_git("diff", "--name-only", f"{EXPECTED_BASE}..{candidate_sha}", "--", "app").splitlines()))
    if changed != expected:
        fail("candidate app path set differs from the frozen 35-path manifest")
    for row in contract["files"]:
        path = ROOT / row["path"]
        try:
            actual_sha = sha256(normalize_text(path.read_bytes()))
        except (OSError, UnicodeDecodeError) as exc:
            raise RuntimeError("candidate source file missing or not UTF-8 text") from exc
        if actual_sha != row["candidateSha256"]:
            fail("candidate source content hash differs from the frozen manifest")
    release = json.loads((ROOT / "app/release.json").read_text(encoding="utf-8"))
    if release.get("version") != EXPECTED_VERSION or release.get("releaseId") != EXPECTED_RELEASE_ID:
        fail("R3 candidate release metadata mismatch")
    member_worker = (ROOT / "app/tennis-note-member-app/service-worker.js").read_text(encoding="utf-8")
    coach_worker = (ROOT / "app/tennis-note-coach-app/service-worker.js").read_text(encoding="utf-8")
    if _cache_counter(member_worker, "tennis-note-member-pwa-") != EXPECTED_MEMBER_CACHE:
        fail("R3 candidate member cache metadata mismatch")
    if _cache_counter(coach_worker, "tennis-note-coach-mode-") != EXPECTED_COACH_CACHE:
        fail("R3 candidate coach cache metadata mismatch")
    return contract


def _extract_assignment(text: str, marker: str, following: str | None = None) -> dict[str, object]:
    start = text.find(marker)
    if start < 0:
        fail("generated runtime config assignment missing")
    start += len(marker)
    end = text.find(following, start) if following else text.find(";", start)
    if end < 0:
        fail("generated runtime config terminator missing")
    return json.loads(text[start:end].strip())


def project_fingerprint(supabase_url: str) -> str:
    clean = supabase_url.strip().lower().rstrip("/")
    project_ref = clean.removeprefix("https://").removesuffix(".supabase.co")
    if not project_ref or "." in project_ref or "/" in project_ref:
        return ""
    return sha256(project_ref.encode("utf-8"))


def verify_dev_artifacts(member_root: Path, admin_root: Path) -> None:
    for root in (member_root, admin_root):
        release = json.loads((root / "release.json").read_text(encoding="utf-8"))
        if release.get("version") != EXPECTED_VERSION or release.get("releaseId") != EXPECTED_RELEASE_ID:
            fail("built development asset release does not match the candidate")
        config_text = (root / "shared/config.local.js").read_text(encoding="utf-8")
        browser = _extract_assignment(config_text, "window.TENNISNOTE_CONFIG = ", ";\n\nwindow.TENNIS_NOTE_PAYMENT_CONFIG")
        payment = _extract_assignment(config_text, "window.TENNIS_NOTE_PAYMENT_CONFIG = ")
        url = browser.get("supabaseUrl")
        if browser.get("environment") != "development" or not isinstance(url, str):
            fail("built app is not bound to development runtime")
        actual_fp = project_fingerprint(url)
        if (actual_fp != EXPECTED_DEV_PROJECT_FINGERPRINT
            or not actual_fp.startswith(EXPECTED_DEV_PROJECT_PREFIX)
            or browser.get("projectFingerprint") != EXPECTED_DEV_PROJECT_FINGERPRINT):
            fail("built app development project fingerprint mismatch")
        if not browser.get("supabasePublishableKey"):
            fail("development publishable key was not configured")
        if payment.get("enabled") is not False or payment.get("mode") != "disabled":
            fail("payments must remain disabled in development candidate")
        if payment.get("allowedMethods") != [] or payment.get("bankTransfer") != {"enabled": False}:
            fail("development payment methods are not fail-closed")
        if payment.get("channels") not in ({}, None):
            fail("development payment channels must be empty")
        index = (root / "index.html").read_text(encoding="utf-8")
        if "개발계 · 실제 결제·푸시 차단" not in index:
            fail("development environment banner missing")


def _numeric_version(value: object, label: str) -> tuple[int, ...]:
    if not isinstance(value, str) or not re.fullmatch(r"\d+(?:\.\d+)+", value):
        fail(f"invalid {label} release value")
    return tuple(int(part) for part in value.split("."))


def _cache_counter(text: str, prefix: str) -> int:
    match = re.search(r'^const CACHE_NAME = "' + re.escape(prefix) + r'v(\d+)";', text, re.M)
    if not match:
        fail("development cache name missing")
    return int(match.group(1))


def validate_cache_floor_provenance() -> None:
    if set(CACHE_FLOOR_CONTRACT) != {"contract", "development", "production"} or CACHE_FLOOR_CONTRACT["contract"] != "r3-dev-cache-floors/1":
        fail("frozen development/production cache floor contract mismatch")
    if (CACHE_FLOOR_CONTRACT["development"] != EXPECTED_CACHE_FLOORS["development"]
        or CACHE_FLOOR_CONTRACT["production"] != EXPECTED_CACHE_FLOORS["production"]):
        fail("frozen cache floor row schema mismatch")


def verify_monotonic_release(candidate_release: dict[str, object], member_cache: int, coach_cache: int,
                             live_states: list[dict[str, object]]) -> None:
    if len(live_states) != 2:
        fail("both development site release baselines are required")
    candidate_version = _numeric_version(candidate_release.get("version"), "candidate version")
    candidate_release_id = _numeric_version(candidate_release.get("releaseId"), "candidate release id")
    for state in live_states:
        current = state.get("release")
        if not isinstance(current, dict):
            fail("live development release baseline malformed")
        if candidate_version < _numeric_version(current.get("version"), "live version"):
            fail("candidate PWA version would roll back a development site")
        if candidate_release_id < _numeric_version(current.get("releaseId"), "live release id"):
            fail("candidate release id would roll back a development site")
        if not isinstance(state.get("member_cache"), int) or member_cache < state["member_cache"]:
            fail("candidate member cache would roll back a development site")
        if not isinstance(state.get("coach_cache"), int) or coach_cache < state["coach_cache"]:
            fail("candidate coach cache would roll back a development site")


def _http_read(url: str, json_body: bool) -> object:
    request = urllib.request.Request(url, headers={"Accept": "application/json" if json_body else "text/plain", "Cache-Control": "no-cache"})
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            raw = response.read(1_000_001)
    except (urllib.error.URLError, TimeoutError, OSError) as exc:
        raise RuntimeError("live development release read failed") from exc
    if len(raw) > 1_000_000:
        fail("live development release response too large")
    try:
        text = raw.decode("utf-8")
        return json.loads(text) if json_body else text
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError("live development release response malformed") from exc


def read_live_dev_states(candidate_sha: str) -> list[dict[str, object]]:
    nonce = urllib.parse.quote(candidate_sha, safe="")
    states = []
    for origin in (DEV_MEMBER_ORIGIN, DEV_ADMIN_ORIGIN):
        release = _http_read(f"{origin}/release.json?__tn_preflight={nonce}", True)
        if not isinstance(release, dict):
            fail("live development release JSON malformed")
        member_worker = _http_read(f"{DEV_MEMBER_ORIGIN}/service-worker.js?__tn_preflight={nonce}", False)
        coach_worker = _http_read(f"{DEV_MEMBER_ORIGIN}/tennis-note-coach-app/service-worker.js?__tn_preflight={nonce}", False)
        states.append({
            "release": release,
            "member_cache": _cache_counter(str(member_worker), "tennis-note-member-pwa-"),
            "coach_cache": _cache_counter(str(coach_worker), "tennis-note-coach-mode-"),
        })
    return states


def verify_monotonic_live_candidate(candidate_sha: str, member_root: Path, admin_root: Path,
                                    expected_project_fp: str) -> None:
    if expected_project_fp != EXPECTED_DEV_PROJECT_FINGERPRINT:
        fail("expected development project fingerprint differs from the pinned guard")
    verify_dev_artifacts(member_root, admin_root)
    candidate_release = json.loads((member_root / "release.json").read_text(encoding="utf-8"))
    member_cache = _cache_counter((member_root / "service-worker.js").read_text(encoding="utf-8"), "tennis-note-member-pwa-")
    coach_cache = _cache_counter((member_root / "tennis-note-coach-app/service-worker.js").read_text(encoding="utf-8"), "tennis-note-coach-mode-")
    if member_cache < EXPECTED_MEMBER_CACHE or coach_cache < EXPECTED_COACH_CACHE:
        fail("candidate cache is below the frozen DEV/PROD monotonic floor")
    verify_monotonic_release(candidate_release, member_cache, coach_cache, read_live_dev_states(candidate_sha))


def rollback_proof(project_name: str, deployments: list[dict[str, object]]) -> dict[str, str]:
    expected_domain = EXPECTED_PROJECT_DOMAINS.get(project_name)
    if project_name not in EXPECTED_PROJECTS or not isinstance(expected_domain, str):
        fail("rollback project is outside the exact development target set")
    valid: list[dict[str, str]] = []
    for item in deployments:
        trigger = item.get("deployment_trigger") or {}
        metadata = trigger.get("metadata") or {}
        latest_stage = item.get("latest_stage") or {}
        deployment_id = item.get("id")
        commit_sha = metadata.get("commit_hash")
        url = item.get("url")
        try:
            parsed_url = urllib.parse.urlsplit(url) if isinstance(url, str) else None
            hostname = parsed_url.hostname.lower() if parsed_url and parsed_url.hostname else ""
            url_belongs_to_project = (
                parsed_url is not None and parsed_url.scheme == "https" and not parsed_url.username
                and not parsed_url.password and parsed_url.port is None
                and (hostname == expected_domain or hostname.endswith("." + expected_domain))
            )
        except ValueError:
            url_belongs_to_project = False
        if (item.get("environment") == "production"
            and metadata.get("branch") == "dev" and latest_stage.get("status") == "success"
            and isinstance(deployment_id, str) and CF_DEPLOYMENT_ID_RE.fullmatch(deployment_id)
            and isinstance(commit_sha, str) and SHA40_RE.fullmatch(commit_sha)
            and url_belongs_to_project):
            valid.append({"id": deployment_id, "commit_sha": commit_sha, "created_on": str(item.get("created_on", ""))})
    if not valid:
        fail(f"no successful prior dev deployment available for rollback: {project_name}")
    valid.sort(key=lambda item: item["created_on"], reverse=True)
    return valid[0]


def cloudflare_get(account_id: str, token: str, path: str) -> dict[str, object]:
    url = f"https://api.cloudflare.com/client/v4/accounts/{urllib.parse.quote(account_id)}/{path.lstrip('/')}"
    request = urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json"})
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            raw = response.read(2_000_001)
    except (urllib.error.URLError, TimeoutError, json.JSONDecodeError, OSError) as exc:
        raise RuntimeError("read-only Cloudflare target check failed") from exc
    if len(raw) > 2_000_000:
        fail("read-only Cloudflare target response exceeds size limit")
    try:
        payload = json.loads(raw)
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise RuntimeError("read-only Cloudflare target response malformed") from exc
    if not isinstance(payload, dict) or payload.get("success") is not True:
        fail("read-only Cloudflare target check returned an invalid response")
    return payload


def verify_live_target(expected_account_fp: str, account_id: str, token: str) -> str:
    if (not SHA256_RE.fullmatch(expected_account_fp) or not re.fullmatch(r"[a-f0-9]{32}", account_id)
        or not token or sha256(account_id.encode("utf-8")) != expected_account_fp):
        fail("approved development Cloudflare account fingerprint or read-only access missing")
    rollback = {}
    for name in EXPECTED_PROJECTS:
        project_response = cloudflare_get(account_id, token, f"pages/projects/{urllib.parse.quote(name, safe='')}")
        project = project_response.get("result")
        if not isinstance(project, dict) or project.get("name") != name:
            fail("exact existing Cloudflare development project is missing")
        if project.get("production_branch") != "dev":
            fail("Cloudflare development project production branch mismatch")
        expected_domain = EXPECTED_PROJECT_DOMAINS[name]
        if project.get("subdomain") != expected_domain:
            fail("Cloudflare development project domain mismatch")
        domains = project.get("domains")
        if not isinstance(domains, list) or expected_domain not in domains:
            fail("Cloudflare development project domain inventory mismatch")
        if any(isinstance(domain, str) and domain in {"tennisnote-app.pages.dev", "tennisnote-admin.pages.dev"} for domain in domains):
            fail("production domain is attached to a development Pages project")
        deployment_response = cloudflare_get(
            account_id, token,
            f"pages/projects/{urllib.parse.quote(name, safe='')}/deployments?env=production&per_page=1",
        )
        rows = deployment_response.get("result")
        if not isinstance(rows, list):
            fail("Cloudflare deployment inventory response malformed")
        rollback[name] = rollback_proof(name, rows)
    proof = sha256(json.dumps(rollback, sort_keys=True, separators=(",", ":")).encode("utf-8"))
    return proof


def preflight() -> None:
    validate_dispatch_context(
        event_name=os.environ.get("GITHUB_EVENT_NAME", ""),
        ref=os.environ.get("GITHUB_REF", ""),
        ref_type=os.environ.get("GITHUB_REF_TYPE", ""),
        workflow_ref=os.environ.get("TENNISNOTE_WORKFLOW_REF", ""),
        workflow_name=os.environ.get("GITHUB_WORKFLOW", ""),
        candidate_sha=os.environ.get("TENNISNOTE_CANDIDATE_SHA", "").lower(),
        github_sha=os.environ.get("GITHUB_SHA", "").lower(),
        head_sha=run_git("rev-parse", "HEAD").lower(),
    )
    verify_source(os.environ["TENNISNOTE_CANDIDATE_SHA"].lower())
    expected_account_fp = os.environ.get("EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT", "").lower()
    verify_monotonic_live_candidate(
        os.environ["TENNISNOTE_CANDIDATE_SHA"].lower(),
        Path("dist/member-dev"),
        Path("dist/admin-dev"),
        EXPECTED_DEV_PROJECT_FINGERPRINT,
    )
    proof = verify_live_target(
        expected_account_fp,
        os.environ.get("CLOUDFLARE_ACCOUNT_ID", ""),
        os.environ.get("CLOUDFLARE_API_TOKEN", ""),
    )
    print(f"R3 candidate/dev target/rollback preflight PASS; rollback proof sha256={proof}")


def branch_preflight() -> None:
    event_name = os.environ.get("GITHUB_EVENT_NAME", "")
    ref = os.environ.get("GITHUB_REF", "")
    ref_type = os.environ.get("GITHUB_REF_TYPE", "")
    workflow_ref = os.environ.get("TENNISNOTE_WORKFLOW_REF", "")
    workflow_name = os.environ.get("GITHUB_WORKFLOW", "")
    if (event_name != "push" or ref != "refs/heads/dev" or ref_type != "branch"
        or workflow_name != EXPECTED_WORKFLOW_NAME
        or not workflow_ref.endswith("/.github/workflows/deploy-cloudflare-pages-dev.yml@refs/heads/dev")):
        fail("automatic deployment is not the expected dev-branch push")
    expected_account_fp = os.environ.get("EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT", "").lower()
    candidate_sha = os.environ.get("GITHUB_SHA", "").lower()
    if not SHA40_RE.fullmatch(candidate_sha):
        fail("development branch SHA is missing")
    verify_dev_artifacts(Path("dist/member-dev"), Path("dist/admin-dev"))
    verify_monotonic_live_candidate(candidate_sha, Path("dist/member-dev"), Path("dist/admin-dev"), EXPECTED_DEV_PROJECT_FINGERPRINT)
    proof = verify_live_target(
        expected_account_fp,
        os.environ.get("CLOUDFLARE_ACCOUNT_ID", ""),
        os.environ.get("CLOUDFLARE_API_TOKEN", ""),
    )
    print(f"Development branch runtime, exact existing projects, rollback and monotonic release PASS; proof sha256={proof}")


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-only", action="store_true")
    parser.add_argument("--live-preflight", action="store_true")
    parser.add_argument("--branch-preflight", action="store_true")
    args = parser.parse_args()
    try:
        if args.source_only:
            validate_dispatch_context(
                event_name=os.environ.get("GITHUB_EVENT_NAME", ""),
                ref=os.environ.get("GITHUB_REF", ""),
                ref_type=os.environ.get("GITHUB_REF_TYPE", ""),
                workflow_ref=os.environ.get("TENNISNOTE_WORKFLOW_REF", ""),
                workflow_name=os.environ.get("GITHUB_WORKFLOW", ""),
                candidate_sha=os.environ.get("TENNISNOTE_CANDIDATE_SHA", "").lower(),
                github_sha=os.environ.get("GITHUB_SHA", "").lower(),
                head_sha=run_git("rev-parse", "HEAD").lower(),
            )
            verify_source(os.environ["TENNISNOTE_CANDIDATE_SHA"].lower())
            print("R3 exact candidate source preflight PASS")
        elif args.live_preflight:
            preflight()
        elif args.branch_preflight:
            branch_preflight()
        else:
            parser.error("select --source-only or --live-preflight")
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError, KeyError, json.JSONDecodeError) as exc:
        print(f"R3 dev preflight FAIL: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
