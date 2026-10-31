#!/usr/bin/env python3
"""Fail-closed source, runtime, and rollback preflight for the exact R3 dev deploy."""

from __future__ import annotations

import argparse
import errno
import hashlib
import http.client
import json
import os
import re
import socket
import ssl
import subprocess
import sys
import time
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
LIVE_READ_ENDPOINTS = {
    "production_member_release": ("https://tennisnote-app.pages.dev", "/release.json", True),
    "production_admin_release": ("https://tennisnote-admin.pages.dev", "/release.json", True),
    "production_pages_release": ("https://leisurewang0827.github.io", "/tennis-note-public/app/release.json", True),
    "member_release": (DEV_MEMBER_ORIGIN, "/release.json", True),
    "admin_release": (DEV_ADMIN_ORIGIN, "/release.json", True),
    "member_worker": (DEV_MEMBER_ORIGIN, "/service-worker.js", False),
    "coach_worker": (DEV_MEMBER_ORIGIN, "/tennis-note-coach-app/service-worker.js", False),
}
LIVE_READ_RETRYABLE_HTTP_STATUSES = frozenset({502, 503, 504})


class _NoRedirectHandler(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, request, response, code, message, headers, new_url):
        return None


# Keep urllib's default HTTPS certificate validation and proxy handling, but do
# not let an approved endpoint silently redirect the bounded live-read guard.
_LIVE_READ_OPENER = urllib.request.build_opener(_NoRedirectHandler())
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


def _network_error_kind(exc: BaseException) -> tuple[str, bool]:
    pending: list[BaseException] = [exc]
    visited: set[int] = set()
    while pending:
        item = pending.pop()
        if id(item) in visited:
            continue
        visited.add(id(item))
        if isinstance(item, ssl.SSLCertVerificationError):
            return "TLS_CERT", False
        if isinstance(item, socket.gaierror):
            if item.errno == socket.EAI_AGAIN:
                return "DNS_AGAIN", True
            return "DNS_PERMANENT", False
        if isinstance(item, (TimeoutError, socket.timeout)):
            return "TIMEOUT", True
        if isinstance(item, ConnectionResetError) or getattr(item, "errno", None) == errno.ECONNRESET:
            return "CONNECTION_RESET", True
        reason = getattr(item, "reason", None)
        if isinstance(reason, BaseException):
            pending.append(reason)
        for chained in (getattr(item, "__cause__", None), getattr(item, "__context__", None)):
            if isinstance(chained, BaseException):
                pending.append(chained)
    return "OTHER", False


def _live_read_failure(endpoint_role: str, reason: str, http_status: int | None = None) -> RuntimeError:
    detail = f" endpoint={endpoint_role} reason={reason}"
    if http_status is not None:
        detail += f" status={http_status}"
    return RuntimeError("live development release read failed" + detail)


def _http_read(endpoint_role: str, candidate_sha: str) -> object:
    endpoint = LIVE_READ_ENDPOINTS.get(endpoint_role)
    if endpoint is None or not SHA40_RE.fullmatch(candidate_sha):
        fail("live development release read endpoint or candidate invalid")
    origin, path, json_body = endpoint
    url = f"{origin}{path}?__tn_preflight={urllib.parse.quote(candidate_sha, safe='')}"
    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json" if json_body else "text/plain",
            "Cache-Control": "no-cache",
            "User-Agent": "TennisNote-Release-Preflight/1.0",
        },
        method="GET",
    )
    for attempt in range(2):
        try:
            with _LIVE_READ_OPENER.open(request, timeout=15) as response:
                raw = response.read(1_000_001)
        except urllib.error.HTTPError as exc:
            status = int(exc.code)
            exc.close()
            retryable = status in LIVE_READ_RETRYABLE_HTTP_STATUSES
            if retryable and attempt == 0:
                time.sleep(0.2)
                continue
            raise _live_read_failure(endpoint_role, "HTTP_STATUS", status) from None
        except (urllib.error.URLError, TimeoutError, OSError, http.client.HTTPException) as exc:
            reason, retryable = _network_error_kind(exc)
            if retryable and attempt == 0:
                time.sleep(0.2)
                continue
            raise _live_read_failure(endpoint_role, reason) from None
        if len(raw) > 1_000_000:
            raise _live_read_failure(endpoint_role, "BODY_TOO_LARGE") from None
        try:
            text = raw.decode("utf-8")
            return json.loads(text) if json_body else text
        except (UnicodeDecodeError, json.JSONDecodeError):
            raise _live_read_failure(endpoint_role, "MALFORMED_BODY") from None
    raise _live_read_failure(endpoint_role, "OTHER") from None


def read_live_dev_states(candidate_sha: str) -> list[dict[str, object]]:
    if not SHA40_RE.fullmatch(candidate_sha):
        fail("live development candidate SHA invalid")
    member_release = _http_read("member_release", candidate_sha)
    admin_release = _http_read("admin_release", candidate_sha)
    if not isinstance(member_release, dict) or not isinstance(admin_release, dict):
        fail("live development release JSON malformed")
    member_worker = _http_read("member_worker", candidate_sha)
    coach_worker = _http_read("coach_worker", candidate_sha)
    member_cache = _cache_counter(str(member_worker), "tennis-note-member-pwa-")
    coach_cache = _cache_counter(str(coach_worker), "tennis-note-coach-mode-")
    return [
        {"release": member_release, "member_cache": member_cache, "coach_cache": coach_cache},
        {"release": admin_release, "member_cache": member_cache, "coach_cache": coach_cache},
    ]


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


# LEGACY_MONTHLY_567_BEGIN
def legacy_monthly_claimed() -> bool:
    return os.environ.get("GITHUB_REF", "").startswith("refs/heads/codex/tennisnote-r3-legacy-monthly-")


def legacy_monthly_need(condition: bool, code: str) -> None:
    if not condition:
        fail("LEGACY_MONTHLY_" + code)


def legacy_monthly_context(env: dict[str, str], head: str) -> str:
    branch = "refs/heads/codex/tennisnote-r3-legacy-monthly-public-20261029"
    candidate = env.get("TENNISNOTE_CANDIDATE_SHA", "")
    legacy_monthly_need(
        env.get("GITHUB_REPOSITORY") == EXPECTED_REPOSITORY
        and env.get("GITHUB_RUN_ATTEMPT") == "1"
        and env.get("GITHUB_EVENT_NAME") == "workflow_dispatch"
        and env.get("GITHUB_REF_TYPE") == "branch" and env.get("GITHUB_REF") == branch
        and env.get("GITHUB_WORKFLOW") == EXPECTED_WORKFLOW_NAME
        and env.get("GITHUB_WORKFLOW_REF") == EXPECTED_REPOSITORY + "/.github/workflows/deploy-cloudflare-pages-dev.yml@" + branch
        and env.get("TENNISNOTE_WORKFLOW_REF") == env.get("GITHUB_WORKFLOW_REF")
        and SHA40_RE.fullmatch(candidate) is not None
        and candidate == env.get("GITHUB_SHA") == env.get("GITHUB_WORKFLOW_SHA") == head,
        "CONTEXT",
    )
    url = env.get("TENNISNOTE_SUPABASE_URL", "")
    legacy_monthly_need(
        env.get("TENNISNOTE_ENVIRONMENT") == "development"
        and re.fullmatch(r"https://[a-z0-9]+\.supabase\.co", url) is not None
        and project_fingerprint(url) == EXPECTED_DEV_PROJECT_FINGERPRINT
        and bool(env.get("TENNISNOTE_SUPABASE_PUBLISHABLE_KEY"))
        and env.get("TENNISNOTE_PAYMENTS_ENABLED") == "false"
        and env.get("TENNISNOTE_PAYMENT_MODE") == "disabled"
        and env.get("TENNISNOTE_ALLOWED_PAYMENT_METHODS", "") == ""
        and env.get("TENNISNOTE_BANK_TRANSFER_ENABLED") == "false",
        "ENVIRONMENT",
    )
    return candidate


def legacy_monthly_proof(proof: object, candidate: str) -> dict[str, object]:
    legacy_monthly_need(isinstance(proof, dict), "SOURCE_SHAPE")
    private = proof.get("privateSource") or {}
    release = proof.get("release") or {}
    legacy_monthly_need(isinstance(private, dict) and isinstance(release, dict), "SOURCE_SHAPE")
    legacy_monthly_need(
        proof.get("status") == "SOURCE_PROVEN" and proof.get("privateSourceBound") is True
        and proof.get("head") == proof.get("checkout") == candidate
        and proof.get("base") == "8cef5b40228c929693c31aaa8af2a089cb0262f4"
        and SHA40_RE.fullmatch(str(proof.get("tree", ""))) is not None
        and proof.get("files") == 24 and proof.get("layers") == 2 and proof.get("immutableDependencies") == 1
        and proof.get("admissionRoute") == "legacy-monthly-dev567-manual"
        and private.get("commit") == "4d9e9aeaab972609f7260b3d7db068ce5708d7b9"
        and private.get("tree") == "0911d86a5b424c3037ec015e430ffdc04e14be95"
        and release.get("version") == release.get("appSurfaceVersion") == "1.0.567"
        and release.get("releaseId") == "2026.10.29.01"
        and release.get("memberCache") == "tennis-note-member-pwa-v600"
        and release.get("coachCache") == "tennis-note-coach-mode-v573"
        and proof.get("databaseActions") == 0,
        "SOURCE_PROOF",
    )
    return proof


def legacy_monthly_source() -> dict[str, object]:
    candidate = legacy_monthly_context(dict(os.environ), run_git("rev-parse", "HEAD"))
    try:
        result = subprocess.run(
            ["node", "scripts/check_r3_purchase_identity_admission.mjs", "--dev-source", "--legacy-monthly"],
            cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=30, check=False,
        )
    except (OSError, subprocess.TimeoutExpired):
        fail("LEGACY_MONTHLY_SOURCE_PROCESS")
    legacy_monthly_need(result.returncode == 0 and len(result.stdout) <= 64000, "SOURCE_PROCESS")
    try:
        proof = json.loads(result.stdout)
    except (ValueError, UnicodeError):
        fail("LEGACY_MONTHLY_SOURCE_JSON")
    return legacy_monthly_proof(proof, candidate)


def legacy_monthly_artifacts(proof: dict[str, object], member_root: Path, admin_root: Path) -> None:
    expected = json.loads((ROOT / "app/release.json").read_text(encoding="utf-8"))
    for root in (member_root, admin_root):
        legacy_monthly_need(json.loads((root / "release.json").read_text(encoding="utf-8")) == expected, "ARTIFACT_RELEASE")
        text = (root / "shared/config.local.js").read_text(encoding="utf-8")
        browser = _extract_assignment(text, "window.TENNISNOTE_CONFIG = ", ";\n\nwindow.TENNIS_NOTE_PAYMENT_CONFIG")
        payment = _extract_assignment(text, "window.TENNIS_NOTE_PAYMENT_CONFIG = ")
        url = browser.get("supabaseUrl")
        legacy_monthly_need(
            browser.get("environment") == "development" and isinstance(url, str)
            and re.fullmatch(r"https://[a-z0-9]+\.supabase\.co", url) is not None
            and project_fingerprint(url) == browser.get("projectFingerprint") == EXPECTED_DEV_PROJECT_FINGERPRINT
            and bool(browser.get("supabasePublishableKey"))
            and browser.get("pushEnabled", False) is False
            and payment.get("enabled") is False and payment.get("mode") == "disabled"
            and payment.get("allowedMethods") == [] and payment.get("bankTransfer") == {"enabled": False}
            and payment.get("channels") in ({}, None)
            and not payment.get("channelKey") and not payment.get("storeId")
            and "개발계 · 실제 결제·푸시 차단" in (root / "index.html").read_text(encoding="utf-8"),
            "ARTIFACT_RUNTIME",
        )
    for path, source in (
        ("service-worker.js", "app/tennis-note-member-app/service-worker.js"),
        ("tennis-note-coach-app/service-worker.js", "app/tennis-note-coach-app/service-worker.js"),
    ):
        legacy_monthly_need(
            normalize_text((member_root / path).read_bytes()) == normalize_text((ROOT / source).read_bytes()),
            "ARTIFACT_CACHE_BYTES",
        )
    legacy_monthly_need(
        expected.get("version") == proof["release"]["version"] and expected.get("releaseId") == proof["release"]["releaseId"],
        "ARTIFACT_SOURCE",
    )


def legacy_monthly_live(proof: dict[str, object]) -> None:
    candidate = proof["head"]
    states = read_live_dev_states(candidate)
    legacy_monthly_need(len(states) == 2, "LIVE_DEV_COUNT")
    for state in states:
        release = state.get("release") or {}
        legacy_monthly_need(
            release.get("version") == "1.0.566" and release.get("releaseId") == "2026.10.28.05"
            and state.get("member_cache") == 599 and state.get("coach_cache") == 572, "LIVE_DEV_BASELINE",
        )
    for role in ("production_member_release", "production_admin_release", "production_pages_release"):
        release = _http_read(role, candidate)
        legacy_monthly_need(
            isinstance(release, dict) and release.get("version") == "1.0.559"
            and release.get("releaseId") == "2026.10.29.01", "LIVE_PROD_BASELINE",
        )
    verify_monotonic_release(proof["release"], 600, 573, states)
    legacy_monthly_need(
        _numeric_version(proof["release"]["version"], "candidate") > _numeric_version("1.0.566", "DEV")
        and _numeric_version(proof["release"]["releaseId"], "candidate") > _numeric_version("2026.10.28.05", "DEV")
        and 600 > max(599, 592) and 573 > max(572, 565), "LIVE_FLOORS",
    )


def legacy_monthly_cloudflare_get(account_id: str, token: str, path: str) -> dict[str, object]:
    allowed = {
        "pages/projects/" + name + suffix
        for name in EXPECTED_PROJECTS for suffix in ("", "/deployments?env=production&per_page=1")
    }
    legacy_monthly_need(path in allowed and re.fullmatch(r"[a-f0-9]{32}", account_id) is not None and bool(token), "TARGET_REQUEST")
    request = urllib.request.Request(
        "https://api.cloudflare.com/client/v4/accounts/" + account_id + "/" + path,
        headers={"Authorization": "Bearer " + token, "Accept": "application/json"}, method="GET",
    )
    try:
        with _LIVE_READ_OPENER.open(request, timeout=20) as response:
            raw = response.read(2_000_001)
        legacy_monthly_need(len(raw) <= 2_000_000, "TARGET_RESPONSE_SIZE")
        result = json.loads(raw)
    except (OSError, ValueError, urllib.error.URLError, http.client.HTTPException):
        fail("LEGACY_MONTHLY_TARGET_READ")
    legacy_monthly_need(isinstance(result, dict) and result.get("success") is True, "TARGET_RESPONSE")
    return result


def legacy_monthly_target(env: dict[str, str], get=None) -> str:
    expected = env.get("EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT", "")
    account, token = env.get("CLOUDFLARE_ACCOUNT_ID", ""), env.get("CLOUDFLARE_API_TOKEN", "")
    legacy_monthly_need(
        SHA256_RE.fullmatch(expected) is not None and re.fullmatch(r"[a-f0-9]{32}", account) is not None
        and bool(token) and sha256(account.encode("utf-8")) == expected, "TARGET_ACCOUNT",
    )
    get = get or legacy_monthly_cloudflare_get
    rollback = {}
    for name in EXPECTED_PROJECTS:
        result = get(account, token, "pages/projects/" + name).get("result")
        domain = EXPECTED_PROJECT_DOMAINS[name]
        domains = result.get("domains") if isinstance(result, dict) else None
        legacy_monthly_need(
            isinstance(result, dict) and result.get("name") == name and result.get("production_branch") == "dev"
            and result.get("subdomain") == domain and isinstance(domains, list)
            and all(isinstance(d, str) for d in domains) and domain in domains
            and all(d not in {"tennisnote-app.pages.dev", "tennisnote-admin.pages.dev"} for d in domains),
            "TARGET_PROJECT",
        )
        rows = get(account, token, "pages/projects/" + name + "/deployments?env=production&per_page=1").get("result")
        legacy_monthly_need(isinstance(rows, list), "TARGET_ROLLBACK_SHAPE")
        previous = rollback_proof(name, rows)
        legacy_monthly_need(previous["commit_sha"] == "2c6eba698c3eaf0bced8352d0b234d463e4689e6", "TARGET_ROLLBACK_SOURCE")
        rollback[name] = previous
    return sha256(json.dumps(rollback, sort_keys=True, separators=(",", ":")).encode("utf-8"))


def legacy_monthly_dispatch(args) -> None:
    legacy_monthly_need(int(args.source_only) + int(args.live_preflight) + int(args.branch_preflight) == 1
                        and not args.branch_preflight, "ENTRYPOINT")
    proof = legacy_monthly_source()
    if args.live_preflight:
        legacy_monthly_artifacts(proof, Path("dist/member-dev"), Path("dist/admin-dev"))
        legacy_monthly_live(proof)
        rollback = legacy_monthly_target(dict(os.environ))
        print("LEGACY_MONTHLY_DEV_PREFLIGHT_PASS rollback_sha256=" + rollback)
    else:
        print("LEGACY_MONTHLY_SOURCE_PASS source_files=24 database_actions=0")
# LEGACY_MONTHLY_567_END


# SUMMARY_LAYOUT_568_BEGIN
# 기존567의 source/runtime/rollback 증거를 바꾸지 않는 새 표시 후보 경계입니다.
def summary_layout_claimed() -> bool:
    return os.environ.get("GITHUB_REF", "").startswith("refs/heads/codex/tennisnote-coach-settlement-summary-")


def summary_layout_context(env: dict[str, str], head: str) -> str:
    branch = "refs/heads/codex/tennisnote-coach-settlement-summary-dev568-20261030"
    candidate = env.get("TENNISNOTE_CANDIDATE_SHA", "")
    legacy_monthly_need(
        env.get("GITHUB_REPOSITORY") == EXPECTED_REPOSITORY and env.get("GITHUB_RUN_ATTEMPT") == "1"
        and env.get("GITHUB_EVENT_NAME") == "workflow_dispatch" and env.get("GITHUB_REF_TYPE") == "branch"
        and env.get("GITHUB_REF") == branch and env.get("GITHUB_WORKFLOW") == EXPECTED_WORKFLOW_NAME
        and env.get("GITHUB_WORKFLOW_REF") == EXPECTED_REPOSITORY + "/.github/workflows/deploy-cloudflare-pages-dev.yml@" + branch
        and env.get("TENNISNOTE_WORKFLOW_REF") == env.get("GITHUB_WORKFLOW_REF")
        and SHA40_RE.fullmatch(candidate) is not None
        and candidate == head == env.get("GITHUB_SHA") == env.get("GITHUB_WORKFLOW_SHA"), "SUMMARY_CONTEXT",
    )
    url = env.get("TENNISNOTE_SUPABASE_URL", "")
    legacy_monthly_need(
        env.get("TENNISNOTE_ENVIRONMENT") == "development"
        and re.fullmatch(r"https://[a-z0-9]+\.supabase\.co", url) is not None
        and project_fingerprint(url) == EXPECTED_DEV_PROJECT_FINGERPRINT
        and bool(env.get("TENNISNOTE_SUPABASE_PUBLISHABLE_KEY"))
        and env.get("TENNISNOTE_PAYMENTS_ENABLED") == "false" and env.get("TENNISNOTE_PAYMENT_MODE") == "disabled"
        and env.get("TENNISNOTE_ALLOWED_PAYMENT_METHODS", "") == ""
        and env.get("TENNISNOTE_BANK_TRANSFER_ENABLED") == "false", "SUMMARY_ENVIRONMENT",
    )
    return candidate


def summary_layout_proof(proof: object, candidate: str) -> dict[str, object]:
    legacy_monthly_need(isinstance(proof, dict), "SUMMARY_PROOF_SHAPE")
    release, private = proof.get("release") or {}, proof.get("privateSource") or {}
    legacy_monthly_need(isinstance(release, dict) and isinstance(private, dict), "SUMMARY_PROOF_SHAPE")
    legacy_monthly_need(
        proof.get("contract") == "r3-summary-public-source/1" and proof.get("status") == "SOURCE_PROVEN"
        and proof.get("head") == proof.get("checkout") == candidate
        and proof.get("base") == "a5503e5855d0b30e34e4992976e6303342c40f9b"
        and SHA40_RE.fullmatch(str(proof.get("tree", ""))) is not None
        and proof.get("profile") == "development" and proof.get("files") == 18 and proof.get("layers") == 2
        and proof.get("admissionRoute") == "summary-layout-dev568-manual"
        and private.get("commit") == "a8da7b7c25f5f47c27cc5d12dcb3fc46b41d26f2"
        and private.get("tree") == "c26e11ee4444eade7e756cfd570bdafdc4827fff"
        and release.get("version") == release.get("appSurfaceVersion") == "1.0.568"
        and re.fullmatch(r"2026\.10\.30\.[0-9]{2}", str(release.get("releaseId", ""))) is not None
        and release.get("memberCache") == "tennis-note-member-pwa-v601"
        and release.get("coachCache") == "tennis-note-coach-mode-v574"
        and proof.get("databaseActions") == 0 and proof.get("browserRuns") == 0, "SUMMARY_SOURCE_PROOF",
    )
    return proof


def summary_layout_source() -> dict[str, object]:
    candidate = summary_layout_context(dict(os.environ), run_git("rev-parse", "HEAD"))
    try:
        result = subprocess.run(["node", "scripts/check_r3_purchase_identity_admission.mjs", "--dev-source", "--summary-layout"],
                                cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=30, check=False)
    except (OSError, subprocess.TimeoutExpired):
        fail("SUMMARY_SOURCE_PROCESS")
    legacy_monthly_need(result.returncode == 0 and len(result.stdout) <= 64000, "SUMMARY_SOURCE_PROCESS")
    try:
        proof = json.loads(result.stdout)
    except (ValueError, UnicodeError):
        fail("SUMMARY_SOURCE_JSON")
    return summary_layout_proof(proof, candidate)


def summary_layout_live(proof: dict[str, object], read_states=None, read_http=None) -> None:
    states = (read_states or read_live_dev_states)(proof["head"])
    legacy_monthly_need(len(states) == 2, "SUMMARY_LIVE_COUNT")
    for state in states:
        release = state.get("release") or {}
        legacy_monthly_need(release.get("version") == "1.0.567" and release.get("releaseId") == "2026.10.29.01"
                            and state.get("member_cache") == 600 and state.get("coach_cache") == 573, "SUMMARY_LIVE_BASELINE")
    for role in ("production_member_release", "production_admin_release", "production_pages_release"):
        release = (read_http or _http_read)(role, proof["head"])
        legacy_monthly_need(isinstance(release, dict) and release.get("version") == "1.0.560"
                            and release.get("releaseId") == "2026.10.29.02", "SUMMARY_PROD_BASELINE")
    verify_monotonic_release(proof["release"], 601, 574, states)
    legacy_monthly_need(601 > max(600, 593) and 574 > max(573, 566), "SUMMARY_CACHE_FLOOR")


def summary_layout_target(env: dict[str, str], get=None) -> str:
    expected, account, token = env.get("EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT", ""), env.get("CLOUDFLARE_ACCOUNT_ID", ""), env.get("CLOUDFLARE_API_TOKEN", "")
    legacy_monthly_need(SHA256_RE.fullmatch(expected) is not None and re.fullmatch(r"[a-f0-9]{32}", account) is not None
                        and bool(token) and sha256(account.encode("utf-8")) == expected, "SUMMARY_TARGET_ACCOUNT")
    get, rollback = get or legacy_monthly_cloudflare_get, {}
    for name in EXPECTED_PROJECTS:
        result = get(account, token, "pages/projects/" + name).get("result")
        domains = result.get("domains") if isinstance(result, dict) else None
        legacy_monthly_need(isinstance(result, dict) and result.get("name") == name and result.get("production_branch") == "dev"
                            and result.get("subdomain") == EXPECTED_PROJECT_DOMAINS[name] and isinstance(domains, list)
                            and all(isinstance(d, str) for d in domains) and EXPECTED_PROJECT_DOMAINS[name] in domains
                            and not any(d in {"tennisnote-app.pages.dev", "tennisnote-admin.pages.dev"} for d in domains), "SUMMARY_TARGET_PROJECT")
        rows = get(account, token, "pages/projects/" + name + "/deployments?env=production&per_page=1").get("result")
        legacy_monthly_need(isinstance(rows, list), "SUMMARY_ROLLBACK_SHAPE")
        previous = rollback_proof(name, rows)
        legacy_monthly_need(previous["commit_sha"] == "a5503e5855d0b30e34e4992976e6303342c40f9b", "SUMMARY_ROLLBACK_SOURCE")
        rollback[name] = previous
    return sha256(json.dumps(rollback, sort_keys=True, separators=(",", ":")).encode("utf-8"))


def summary_layout_dispatch(args) -> None:
    legacy_monthly_need(int(args.source_only) + int(args.live_preflight) + int(args.branch_preflight) == 1
                        and not args.branch_preflight, "SUMMARY_ENTRY")
    proof = summary_layout_source()
    if args.live_preflight:
        # 동일 runtime/asset 검증 함수를 새568 proof에 적용; 과거567 source proof는 사용하지 않습니다.
        legacy_monthly_artifacts(proof, Path("dist/member-dev"), Path("dist/admin-dev"))
        summary_layout_live(proof)
        print("SUMMARY_LAYOUT_DEV_PREFLIGHT_PASS rollback_sha256=" + summary_layout_target(dict(os.environ)))
    else:
        print("SUMMARY_LAYOUT_SOURCE_PASS source_files=18 database_actions=0")
# SUMMARY_LAYOUT_568_END


def row_scope_validate_ci_evidence(run, pr, head_commit, source_commit, merge_commit, candidate):
    """Pure metadata check only; this does not itself admit or deploy a candidate."""
    repo = "leisurewang0827/tennis-note-public"
    base = "d4ee449afcc5f442e5e98cc2792bff87146bffd1"
    branch = "codex/tennisnote-r3-substitute-row-scope-dev569-20261030"
    base_branch = "codex/tennisnote-coach-settlement-summary-dev568-20261030"
    def require(ok):
        if not ok:
            raise ValueError("ROW_SCOPE_CI_EVIDENCE_MISMATCH")
    def parents(commit):
        return [entry.get("sha") for entry in commit.get("parents", [])]
    require(isinstance(candidate, str) and SHA40_RE.fullmatch(candidate) is not None)
    require(isinstance(run, dict) and isinstance(pr, dict))
    require(run.get("workflow_id") == 329932540 and run.get("path") == ".github/workflows/tennisnote-public-ci.yml")
    require(run.get("event") == "pull_request" and run.get("head_sha") == candidate)
    require(type(run.get("id")) is int and run["id"] > 0 and run.get("run_attempt") == 1)
    require(run.get("status") == "completed" and run.get("conclusion") == "success")
    require((run.get("repository") or {}).get("full_name") == repo and (run.get("head_repository") or {}).get("full_name") == repo)
    require(pr.get("state") == "open" and type(pr.get("number")) is int and pr["number"] > 0)
    require((pr.get("head") or {}).get("sha") == candidate and (pr.get("head") or {}).get("ref") == branch)
    require(((pr.get("head") or {}).get("repo") or {}).get("full_name") == repo)
    require((pr.get("base") or {}).get("sha") == base and (pr.get("base") or {}).get("ref") == base_branch)
    require(((pr.get("base") or {}).get("repo") or {}).get("full_name") == repo)
    links = run.get("pull_requests")
    require(isinstance(links, list) and len(links) == 1 and links[0].get("number") == pr["number"])
    require((links[0].get("head") or {}).get("sha") == candidate and (links[0].get("base") or {}).get("sha") == base)
    require(all(isinstance(value, dict) for value in (head_commit, source_commit, merge_commit)))
    require(head_commit.get("sha") == candidate and len(parents(head_commit)) == 1)
    require(SHA40_RE.fullmatch(str(source_commit.get("sha", ""))) is not None)
    require(SHA40_RE.fullmatch(str(merge_commit.get("sha", ""))) is not None)
    require(source_commit.get("sha") == parents(head_commit)[0] and parents(source_commit) == [base])
    require(merge_commit.get("sha") == pr.get("merge_commit_sha") and parents(merge_commit) == [base, candidate])
    require((head_commit.get("tree") or {}).get("sha") == (merge_commit.get("tree") or {}).get("sha"))
    require(SHA40_RE.fullmatch(str((head_commit.get("tree") or {}).get("sha", ""))) is not None)
    return {"status": "CI_METADATA_BOUND", "runId": run["id"], "prNumber": pr["number"], "candidate": candidate,
            "tree": head_commit["tree"]["sha"]}


# ROW_SCOPE_DEV_569_BEGIN
ROW_SCOPE_DEV_BRANCH = "codex/tennisnote-r3-substitute-row-scope-dev569-20261030"
ROW_SCOPE_DEV_BASE = "d4ee449afcc5f442e5e98cc2792bff87146bffd1"
ROW_SCOPE_API = "https://api.github.com/repos/leisurewang0827/tennis-note-public/"


def row_scope_context(env, head):
    candidate = env.get("TENNISNOTE_CANDIDATE_SHA", "")
    legacy_monthly_need(env.get("GITHUB_EVENT_NAME") == "workflow_dispatch" and env.get("GITHUB_REPOSITORY") == EXPECTED_REPOSITORY
        and env.get("GITHUB_REF") == "refs/heads/" + ROW_SCOPE_DEV_BRANCH and env.get("GITHUB_REF_TYPE") == "branch"
        and env.get("GITHUB_WORKFLOW") == EXPECTED_WORKFLOW_NAME
        and env.get("TENNISNOTE_WORKFLOW_REF") == EXPECTED_REPOSITORY + "/.github/workflows/deploy-cloudflare-pages-dev.yml@refs/heads/" + ROW_SCOPE_DEV_BRANCH
        and env.get("GITHUB_RUN_ATTEMPT") == "1" and SHA40_RE.fullmatch(candidate or "") is not None
        and candidate == env.get("GITHUB_SHA") == head, "ROW_SCOPE_CONTEXT")
    return candidate


def row_scope_source_proof(proof, candidate):
    legacy_monthly_need(isinstance(proof, dict), "ROW_SCOPE_SOURCE_SHAPE")
    release = proof.get("release") or {}
    legacy_monthly_need(isinstance(release, dict) and proof.get("contract") == "r3-substitute-row-scope-public/1"
        and proof.get("status") == "SOURCE_PROVEN" and proof.get("base") == ROW_SCOPE_DEV_BASE
        and proof.get("branch") == ROW_SCOPE_DEV_BRANCH and proof.get("head") == proof.get("checkout") == candidate
        and SHA40_RE.fullmatch(str(proof.get("tree", ""))) is not None
        and proof.get("sourceFiles") == 9 and proof.get("metadataFiles") == 13 and proof.get("layers") == 2
        and release.get("version") == release.get("appSurfaceVersion") == "1.0.569"
        and release.get("releaseId") == "2026.10.30.02" and release.get("memberCache") == "tennis-note-member-pwa-v602"
        and release.get("coachCache") == "tennis-note-coach-mode-v575"
        and proof.get("databaseActions") == 0 and proof.get("deploymentAdmitted") is False, "ROW_SCOPE_SOURCE")
    return proof


def row_scope_github_get(path):
    allowed = (r"actions/workflows/tennisnote-public-ci\.yml/runs\?head_sha=[a-f0-9]{40}&event=pull_request&per_page=100",
        r"actions/runs/[1-9][0-9]*", r"pulls/[1-9][0-9]*", r"git/commits/[a-f0-9]{40}")
    legacy_monthly_need(isinstance(path, str) and any(re.fullmatch(pattern, path) for pattern in allowed), "ROW_SCOPE_GITHUB_PATH")
    request = urllib.request.Request(ROW_SCOPE_API + path, headers={"Accept": "application/vnd.github+json", "User-Agent": "TennisNote-DEV-source-check"})
    opener = urllib.request.build_opener(_NoRedirectHandler())
    with opener.open(request, timeout=15) as response:
        legacy_monthly_need(response.status == 200, "ROW_SCOPE_GITHUB_STATUS")
        payload = response.read(1024 * 1024 + 1)
    legacy_monthly_need(len(payload) <= 1024 * 1024, "ROW_SCOPE_GITHUB_SIZE")
    result = json.loads(payload.decode("utf-8"))
    legacy_monthly_need(isinstance(result, dict), "ROW_SCOPE_GITHUB_JSON")
    return result


def row_scope_ci(candidate, get=None):
    legacy_monthly_need(isinstance(candidate, str) and SHA40_RE.fullmatch(candidate) is not None, "ROW_SCOPE_CI_HEAD")
    get = get or row_scope_github_get
    listing = get("actions/workflows/tennisnote-public-ci.yml/runs?head_sha=" + candidate + "&event=pull_request&per_page=100")
    rows = listing.get("workflow_runs") if isinstance(listing, dict) else None
    legacy_monthly_need(isinstance(rows, list) and len(rows) < 100, "ROW_SCOPE_CI_LIST")
    matches = [r for r in rows if isinstance(r, dict) and r.get("head_sha") == candidate and r.get("event") == "pull_request"
        and r.get("workflow_id") == 329932540]
    legacy_monthly_need(len(matches) == 1 and type(matches[0].get("id")) is int and matches[0]["id"] > 0, "ROW_SCOPE_CI_UNIQUE")
    run = get("actions/runs/" + str(matches[0]["id"]))
    links = run.get("pull_requests") if isinstance(run, dict) else None
    legacy_monthly_need(isinstance(links, list) and len(links) == 1 and type(links[0].get("number")) is int and links[0]["number"] > 0, "ROW_SCOPE_CI_PR")
    pr = get("pulls/" + str(links[0]["number"]))
    head = get("git/commits/" + candidate)
    parents = head.get("parents") if isinstance(head, dict) else None
    legacy_monthly_need(isinstance(parents, list) and len(parents) == 1 and SHA40_RE.fullmatch(str(parents[0].get("sha", ""))) is not None, "ROW_SCOPE_SOURCE_PARENT")
    source = get("git/commits/" + parents[0]["sha"])
    merge_sha = pr.get("merge_commit_sha") if isinstance(pr, dict) else None
    legacy_monthly_need(isinstance(merge_sha, str) and SHA40_RE.fullmatch(merge_sha) is not None, "ROW_SCOPE_MERGE_SHA")
    merge = get("git/commits/" + merge_sha)
    proof = row_scope_validate_ci_evidence(run, pr, head, source, merge, candidate)
    legacy_monthly_need(proof.get("runId") == matches[0]["id"], "ROW_SCOPE_RUN_BINDING")
    return proof


def row_scope_live(proof, states=None, read=None):
    states = (states or read_live_dev_states)(proof["head"])
    legacy_monthly_need(isinstance(states, list) and len(states) == 2, "ROW_SCOPE_LIVE_COUNT")
    for state in states:
        release = state.get("release") or {}
        legacy_monthly_need(release.get("version") == "1.0.568" and release.get("releaseId") == "2026.10.30.01"
            and state.get("member_cache") == 601 and state.get("coach_cache") == 574, "ROW_SCOPE_LIVE_BASELINE")
    for role in ("production_member_release", "production_admin_release", "production_pages_release"):
        release = (read or _http_read)(role, proof["head"])
        legacy_monthly_need(isinstance(release, dict) and release.get("version") == "1.0.561"
            and release.get("releaseId") == "2026.10.30.01", "ROW_SCOPE_PROD_BASELINE")
    verify_monotonic_release(proof["release"], 602, 575, states)


def row_scope_target(env, get=None):
    expected, account, token = env.get("EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT", ""), env.get("CLOUDFLARE_ACCOUNT_ID", ""), env.get("CLOUDFLARE_API_TOKEN", "")
    legacy_monthly_need(SHA256_RE.fullmatch(expected) is not None and re.fullmatch(r"[a-f0-9]{32}", account) is not None
        and bool(token) and sha256(account.encode("utf-8")) == expected, "ROW_SCOPE_TARGET_ACCOUNT")
    get, rollback = get or legacy_monthly_cloudflare_get, {}
    for name in EXPECTED_PROJECTS:
        result = get(account, token, "pages/projects/" + name).get("result")
        domains = result.get("domains") if isinstance(result, dict) else None
        legacy_monthly_need(isinstance(result, dict) and result.get("name") == name and result.get("production_branch") == "dev"
            and result.get("subdomain") == EXPECTED_PROJECT_DOMAINS[name] and isinstance(domains, list)
            and EXPECTED_PROJECT_DOMAINS[name] in domains and all(isinstance(d, str) for d in domains)
            and not any(d in {"tennisnote-app.pages.dev", "tennisnote-admin.pages.dev"} for d in domains), "ROW_SCOPE_TARGET_PROJECT")
        rows = get(account, token, "pages/projects/" + name + "/deployments?env=production&per_page=1").get("result")
        legacy_monthly_need(isinstance(rows, list), "ROW_SCOPE_ROLLBACK_SHAPE")
        previous = rollback_proof(name, rows)
        legacy_monthly_need(previous["commit_sha"] == ROW_SCOPE_DEV_BASE, "ROW_SCOPE_ROLLBACK_SOURCE")
        rollback[name] = previous
    legacy_monthly_need(len(rollback) == 2, "ROW_SCOPE_ROLLBACK_COUNT")
    return sha256(json.dumps(rollback, sort_keys=True, separators=(",", ":")).encode("utf-8"))


def row_scope_dispatch(args):
    legacy_monthly_need(int(args.source_only) + int(args.live_preflight) + int(args.branch_preflight) == 1 and not args.branch_preflight, "ROW_SCOPE_ENTRY")
    candidate = row_scope_context(dict(os.environ), run_git("rev-parse", "HEAD"))
    try:
        result = subprocess.run(["node", "scripts/check_r3_purchase_identity_admission.mjs", "--dev-source", "--row-scope"],
            cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=30, check=False)
    except (OSError, subprocess.TimeoutExpired):
        fail("ROW_SCOPE_SOURCE_PROCESS")
    legacy_monthly_need(result.returncode == 0 and len(result.stdout) <= 64000, "ROW_SCOPE_SOURCE_PROCESS")
    proof = row_scope_source_proof(json.loads(result.stdout), candidate)
    ci = row_scope_ci(candidate)
    legacy_monthly_need(proof["tree"] == ci.get("tree"), "ROW_SCOPE_SOURCE_CI_TREE")
    if args.live_preflight:
        legacy_monthly_artifacts(proof, Path("dist/member-dev"), Path("dist/admin-dev"))
        row_scope_live(proof)
        rollback = row_scope_target(dict(os.environ))
        print("ROW_SCOPE_DEV_PREFLIGHT_PASS run_id=" + str(ci["runId"]) + " rollback_sha256=" + rollback)
    else:
        print("ROW_SCOPE_SOURCE_AND_CI_PASS run_id=" + str(ci["runId"]))
# ROW_SCOPE_DEV_569_END

# CURRENT_TERM_DEV_570_BEGIN
CURRENT_TERM_DEV_BRANCH = "codex/tennisnote-r3-current-term-dev570-20261031"
CURRENT_TERM_DEV_BASE = "436d11ac11fb31ff0d02a8f9de9233a71f0fe00f"
CURRENT_TERM_PRIVATE_SOURCE_COMMIT = "5f6684792b83ca2a3f381517aab22e6be1e2c08a"
CURRENT_TERM_PRIVATE_SOURCE_TREE = "e7f4b8c5bb57fb1d860c46f34f3354c2c3b02d2c"
CURRENT_TERM_PRIVATE_SOURCE_LF_SHA256 = "69dd4cb4c6db3038b32455f4a1375cacda448a33960077cd43f96ef0667fe2ca"


def current_term_dev_context(env, head):
    candidate = env.get("TENNISNOTE_CANDIDATE_SHA", "")
    legacy_monthly_need(env.get("GITHUB_EVENT_NAME") == "workflow_dispatch"
        and env.get("GITHUB_REPOSITORY") == EXPECTED_REPOSITORY
        and env.get("GITHUB_REF") == "refs/heads/" + CURRENT_TERM_DEV_BRANCH
        and env.get("GITHUB_REF_TYPE") == "branch"
        and env.get("GITHUB_WORKFLOW") == EXPECTED_WORKFLOW_NAME
        and env.get("TENNISNOTE_WORKFLOW_REF") == EXPECTED_REPOSITORY + "/.github/workflows/deploy-cloudflare-pages-dev.yml@refs/heads/" + CURRENT_TERM_DEV_BRANCH
        and env.get("GITHUB_RUN_ATTEMPT") == "1" and SHA40_RE.fullmatch(candidate or "") is not None
        and candidate == env.get("GITHUB_SHA") == head, "CURRENT_TERM_CONTEXT")
    return candidate


def current_term_dev_release(release):
    legacy_monthly_need(isinstance(release, dict)
        and release.get("version") == release.get("appSurfaceVersion") == "1.0.570"
        and release.get("releaseId") == "2026.10.31.01"
        and release.get("memberCache") == "tennis-note-member-pwa-v603"
        and release.get("coachCache") == "tennis-note-coach-mode-v576", "CURRENT_TERM_RELEASE")


def current_term_dev_live_baseline(states):
    legacy_monthly_need(isinstance(states, list) and len(states) == 2, "CURRENT_TERM_LIVE_COUNT")
    for state in states:
        release = state.get("release") or {}
        legacy_monthly_need(release.get("version") == "1.0.569" and release.get("releaseId") == "2026.10.30.02"
            and state.get("member_cache") == 602 and state.get("coach_cache") == 575, "CURRENT_TERM_LIVE_BASELINE")


def current_term_dev_ci_evidence(run, pr, head_commit, source_commit, merge_commit, candidate):
    repo = "leisurewang0827/tennis-note-public"
    parent = "codex/tennisnote-r3-substitute-row-scope-dev569-20261030"
    def parents(commit):
        return [entry.get("sha") for entry in commit.get("parents", [])]
    legacy_monthly_need(isinstance(candidate, str) and SHA40_RE.fullmatch(candidate) is not None
        and isinstance(run, dict) and isinstance(pr, dict)
        and isinstance(head_commit, dict) and isinstance(source_commit, dict) and isinstance(merge_commit, dict), "CURRENT_TERM_CI_SHAPE")
    links = run.get("pull_requests")
    legacy_monthly_need(run.get("workflow_id") == 329932540 and run.get("path") == ".github/workflows/tennisnote-public-ci.yml"
        and run.get("event") == "pull_request" and run.get("head_sha") == candidate
        and run.get("run_attempt") == 1 and type(run.get("id")) is int and run["id"] > 0
        and run.get("status") == "completed" and run.get("conclusion") == "success"
        and (run.get("repository") or {}).get("full_name") == repo
        and (run.get("head_repository") or {}).get("full_name") == repo, "CURRENT_TERM_CI_RUN")
    legacy_monthly_need(pr.get("state") == "open" and type(pr.get("number")) is int and pr["number"] > 0
        and (pr.get("head") or {}).get("sha") == candidate and (pr.get("head") or {}).get("ref") == CURRENT_TERM_DEV_BRANCH
        and ((pr.get("head") or {}).get("repo") or {}).get("full_name") == repo
        and (pr.get("base") or {}).get("sha") == CURRENT_TERM_DEV_BASE and (pr.get("base") or {}).get("ref") == parent
        and ((pr.get("base") or {}).get("repo") or {}).get("full_name") == repo
        and isinstance(links, list) and len(links) == 1 and links[0].get("number") == pr["number"]
        and (links[0].get("head") or {}).get("sha") == candidate
        and (links[0].get("base") or {}).get("sha") == CURRENT_TERM_DEV_BASE, "CURRENT_TERM_CI_PR")
    tree = (head_commit.get("tree") or {}).get("sha")
    source_sha = source_commit.get("sha")
    legacy_monthly_need(isinstance(source_sha, str) and SHA40_RE.fullmatch(source_sha) is not None
        and head_commit.get("sha") == candidate and parents(head_commit) == [source_sha]
        and parents(source_commit) == [CURRENT_TERM_DEV_BASE]
        and merge_commit.get("sha") == pr.get("merge_commit_sha")
        and parents(merge_commit) == [CURRENT_TERM_DEV_BASE, candidate]
        and SHA40_RE.fullmatch(str(tree or "")) is not None
        and tree == (merge_commit.get("tree") or {}).get("sha"), "CURRENT_TERM_CI_GRAPH")
    return {"status": "CI_METADATA_ONLY_NOT_DEPLOYMENT", "candidate": candidate, "source": source_sha, "tree": tree, "runId": run["id"]}


def current_term_dev_source_proof(proof, candidate):
    legacy_monthly_need(isinstance(proof, dict) and proof.get("contract") == "r3-current-term-public/1"
        and proof.get("status") == "SOURCE_PROVEN" and proof.get("base") == CURRENT_TERM_DEV_BASE
        and proof.get("branch") == CURRENT_TERM_DEV_BRANCH and proof.get("head") == proof.get("checkout") == candidate
        and SHA40_RE.fullmatch(str(proof.get("source", ""))) is not None
        and SHA40_RE.fullmatch(str(proof.get("tree", ""))) is not None
        and proof.get("sourceFiles") == 7 and proof.get("metadataFiles") == 13 and proof.get("layers") == 2
        and proof.get("privateSourceCommit") == CURRENT_TERM_PRIVATE_SOURCE_COMMIT
        and proof.get("privateSourceTree") == CURRENT_TERM_PRIVATE_SOURCE_TREE
        and proof.get("privateSourceLfSha256") == CURRENT_TERM_PRIVATE_SOURCE_LF_SHA256
        and proof.get("databaseActions") == 0 and proof.get("deploymentAdmitted") is False, "CURRENT_TERM_SOURCE")
    current_term_dev_release(proof.get("release"))
    return proof


def current_term_dev_ci(candidate, get=None):
    legacy_monthly_need(isinstance(candidate, str) and SHA40_RE.fullmatch(candidate) is not None, "CURRENT_TERM_CI_HEAD")
    get = get or row_scope_github_get
    listing = get("actions/workflows/tennisnote-public-ci.yml/runs?head_sha=" + candidate + "&event=pull_request&per_page=100")
    rows = listing.get("workflow_runs") if isinstance(listing, dict) else None
    legacy_monthly_need(isinstance(rows, list) and len(rows) < 100, "CURRENT_TERM_CI_LIST")
    matches = [r for r in rows if isinstance(r, dict) and r.get("head_sha") == candidate
        and r.get("event") == "pull_request" and r.get("workflow_id") == 329932540]
    legacy_monthly_need(len(matches) == 1 and type(matches[0].get("id")) is int and matches[0]["id"] > 0, "CURRENT_TERM_CI_UNIQUE")
    run = get("actions/runs/" + str(matches[0]["id"]))
    links = run.get("pull_requests") if isinstance(run, dict) else None
    legacy_monthly_need(isinstance(links, list) and len(links) == 1 and type(links[0].get("number")) is int
        and links[0]["number"] > 0, "CURRENT_TERM_CI_PR")
    pr = get("pulls/" + str(links[0]["number"]))
    head = get("git/commits/" + candidate)
    parents = head.get("parents") if isinstance(head, dict) else None
    legacy_monthly_need(isinstance(parents, list) and len(parents) == 1
        and SHA40_RE.fullmatch(str(parents[0].get("sha", ""))) is not None, "CURRENT_TERM_CI_SOURCE")
    source = get("git/commits/" + parents[0]["sha"])
    merge_sha = pr.get("merge_commit_sha") if isinstance(pr, dict) else None
    legacy_monthly_need(isinstance(merge_sha, str) and SHA40_RE.fullmatch(merge_sha) is not None, "CURRENT_TERM_CI_MERGE")
    merge = get("git/commits/" + merge_sha)
    proof = current_term_dev_ci_evidence(run, pr, head, source, merge, candidate)
    legacy_monthly_need(proof["runId"] == matches[0]["id"], "CURRENT_TERM_CI_BINDING")
    return proof


def current_term_dev_target(env, get=None):
    expected = env.get("EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT", "")
    account, token = env.get("CLOUDFLARE_ACCOUNT_ID", ""), env.get("CLOUDFLARE_API_TOKEN", "")
    legacy_monthly_need(SHA256_RE.fullmatch(expected) is not None and re.fullmatch(r"[a-f0-9]{32}", account) is not None
        and bool(token) and sha256(account.encode("utf-8")) == expected, "CURRENT_TERM_ACCOUNT")
    get, rollback = get or legacy_monthly_cloudflare_get, {}
    for name in EXPECTED_PROJECTS:
        result = get(account, token, "pages/projects/" + name).get("result")
        domains = result.get("domains") if isinstance(result, dict) else None
        legacy_monthly_need(isinstance(result, dict) and result.get("name") == name and result.get("production_branch") == "dev"
            and result.get("subdomain") == EXPECTED_PROJECT_DOMAINS[name] and isinstance(domains, list)
            and EXPECTED_PROJECT_DOMAINS[name] in domains and all(isinstance(d, str) for d in domains)
            and not any(d in {"tennisnote-app.pages.dev", "tennisnote-admin.pages.dev"} for d in domains), "CURRENT_TERM_PROJECT")
        rows = get(account, token, "pages/projects/" + name + "/deployments?env=production&per_page=1").get("result")
        legacy_monthly_need(isinstance(rows, list), "CURRENT_TERM_ROLLBACK_SHAPE")
        previous = rollback_proof(name, rows)
        legacy_monthly_need(previous["commit_sha"] == CURRENT_TERM_DEV_BASE, "CURRENT_TERM_ROLLBACK_SOURCE")
        rollback[name] = previous
    legacy_monthly_need(len(rollback) == 2, "CURRENT_TERM_ROLLBACK_COUNT")
    return sha256(json.dumps(rollback, sort_keys=True, separators=(",", ":")).encode("utf-8"))


def current_term_dev_dispatch(args):
    legacy_monthly_need(int(args.source_only) + int(args.live_preflight) + int(args.branch_preflight) == 1
        and not args.branch_preflight, "CURRENT_TERM_ENTRY")
    candidate = current_term_dev_context(dict(os.environ), run_git("rev-parse", "HEAD"))
    legacy_monthly_need(isinstance(CURRENT_TERM_PRIVATE_SOURCE_COMMIT, str)
        and SHA40_RE.fullmatch(CURRENT_TERM_PRIVATE_SOURCE_COMMIT) is not None, "CURRENT_TERM_PRIVATE_BINDING_PENDING")
    try:
        result = subprocess.run(["node", "scripts/check_r3_purchase_identity_admission.mjs", "--dev-source", "--current-term"],
            cwd=ROOT, text=True, encoding="utf-8", capture_output=True, timeout=30, check=False)
    except (OSError, subprocess.TimeoutExpired):
        fail("CURRENT_TERM_SOURCE_PROCESS")
    legacy_monthly_need(result.returncode == 0 and len(result.stdout) <= 64000, "CURRENT_TERM_SOURCE_PROCESS")
    proof = current_term_dev_source_proof(json.loads(result.stdout), candidate)
    ci = current_term_dev_ci(candidate)
    legacy_monthly_need(proof["tree"] == ci["tree"] and proof["source"] == ci["source"], "CURRENT_TERM_SOURCE_CI_TREE")
    if args.live_preflight:
        legacy_monthly_artifacts(proof, Path("dist/member-dev"), Path("dist/admin-dev"))
        states = read_live_dev_states(candidate)
        current_term_dev_live_baseline(states)
        for role in ("production_member_release", "production_admin_release", "production_pages_release"):
            release = _http_read(role, candidate)
            legacy_monthly_need(isinstance(release, dict) and release.get("version") == "1.0.561"
                and release.get("releaseId") == "2026.10.30.01", "CURRENT_TERM_PROD_BASELINE")
        verify_monotonic_release(proof["release"], 603, 576, states)
        rollback = current_term_dev_target(dict(os.environ))
        print("CURRENT_TERM_DEV_PREFLIGHT_PASS run_id=" + str(ci["runId"]) + " rollback_sha256=" + rollback)
    else:
        print("CURRENT_TERM_SOURCE_AND_CI_PASS run_id=" + str(ci["runId"]))
# CURRENT_TERM_DEV_570_END

# Response-label successor. The old 570 admission remains unchanged.
STATUS_DEV_BRANCH = "codex/tennisnote-r3-admin-response-label-dev571-20261031"
STATUS_DEV_BASE = "efc84a88a389b292ff226b760c935de19ac9f07b"
STATUS_DEV_PARENT = "codex/tennisnote-r3-current-term-dev570-20261031"
STATUS_DEV_SOURCE = "fb4c6a6377c0efaf64d63fbfb219688b7bc0e9e4"
STATUS_DEV_METADATA = "be29bbc2f7b18ba05eb8f943a0640cb9205c9578"
STATUS_DEV_CORRECTIVE = "e760e655080466e436146c483dc249aca9213fc0"
STATUS_DEV_FIX = {".github/workflows/tennisnote-public-ci.yml", "scripts/check_r3_dev_deployment.py",
    "scripts/check_r3_response_label_successor.cjs", "scripts/collect_r3_response_label_pr.cjs",
    "tests/r3-response-label-successor-core.test.cjs", "tests/r3-response-label-collector.test.cjs",
    "tests/r3-response-label-deploy.test.py"}
STATUS_DEV_AUTH_FIX = STATUS_DEV_FIX | {".github/workflows/deploy-cloudflare-pages-dev.yml"}
STATUS_WIRING = {
    "scripts/check_r3_response_label_successor.cjs", "tests/r3-response-label-successor-core.test.cjs",
    "scripts/collect_r3_response_label_pr.cjs", "tests/r3-response-label-collector.test.cjs",
    "tests/r3-response-label-deploy.test.py",
    ".github/workflows/tennisnote-public-ci.yml", "scripts/check_r3_dev_deployment.py",
    ".github/workflows/deploy-cloudflare-pages-dev.yml",
}

def status_dev_ci_evidence(run, pr, head, corrective, metadata_commit, source, merge, jobs, candidate):
    repo = EXPECTED_REPOSITORY
    links = run.get("pull_requests") if isinstance(run, dict) else None
    legacy_monthly_need(isinstance(run, dict) and isinstance(pr, dict) and isinstance(head, dict) and isinstance(corrective, dict) and isinstance(metadata_commit, dict) and isinstance(source, dict) and isinstance(merge, dict)
        and isinstance(candidate, str) and SHA40_RE.fullmatch(candidate) is not None
        and run.get("workflow_id") == 329932540 and run.get("path") == ".github/workflows/tennisnote-public-ci.yml"
        and run.get("event") == "pull_request" and run.get("head_sha") == candidate
        and run.get("run_attempt") == 1 and run.get("status") == "completed" and run.get("conclusion") == "success"
        and (run.get("repository") or {}).get("full_name") == repo and (run.get("head_repository") or {}).get("full_name") == repo
        and type(run.get("id")) is int and run["id"] > 0, "STATUS_CI_RUN")
    legacy_monthly_need(pr.get("state") == "open" and type(pr.get("number")) is int and pr["number"] > 0
        and (pr.get("head") or {}).get("sha") == candidate and (pr.get("head") or {}).get("ref") == STATUS_DEV_BRANCH
        and ((pr.get("head") or {}).get("repo") or {}).get("full_name") == repo
        and (pr.get("base") or {}).get("sha") == STATUS_DEV_BASE and (pr.get("base") or {}).get("ref") == STATUS_DEV_PARENT
        and ((pr.get("base") or {}).get("repo") or {}).get("full_name") == repo
        and isinstance(links, list) and len(links) == 1 and links[0].get("number") == pr["number"]
        and (links[0].get("head") or {}).get("sha") == candidate and (links[0].get("base") or {}).get("sha") == STATUS_DEV_BASE, "STATUS_CI_PR")
    tree = (head.get("tree") or {}).get("sha")
    source_sha = source.get("sha")
    legacy_monthly_need(source_sha == STATUS_DEV_SOURCE and metadata_commit.get("sha") == STATUS_DEV_METADATA
        and corrective.get("sha") == STATUS_DEV_CORRECTIVE
        and head.get("sha") == candidate and [x.get("sha") for x in head.get("parents", [])] == [STATUS_DEV_CORRECTIVE]
        and [x.get("sha") for x in corrective.get("parents", [])] == [STATUS_DEV_METADATA]
        and [x.get("sha") for x in metadata_commit.get("parents", [])] == [source_sha]
        and [x.get("sha") for x in source.get("parents", [])] == [STATUS_DEV_BASE]
        and merge.get("sha") == pr.get("merge_commit_sha") and [x.get("sha") for x in merge.get("parents", [])] == [STATUS_DEV_BASE, candidate]
        and SHA40_RE.fullmatch(str(tree or "")) is not None and tree == (merge.get("tree") or {}).get("sha"), "STATUS_CI_GRAPH")
    entries = jobs.get("jobs") if isinstance(jobs, dict) else None
    legacy_monthly_need(isinstance(entries, list) and len(entries) == 1, "STATUS_CI_JOBS")
    job = entries[0]
    steps = job.get("steps") if isinstance(job, dict) else None
    legacy_monthly_need(job.get("name") == "build-and-check" and job.get("status") == "completed" and job.get("conclusion") == "success"
        and isinstance(steps, list) and sum(1 for step in steps if step.get("name") == "Admit exact response-label successor"
        and step.get("status") == "completed" and step.get("conclusion") == "success") == 1, "STATUS_CI_JOB")
    return {"runId": run["id"], "tree": tree, "source": source_sha}

def status_dev_github_get(path, token=None, opener=None):
    allowed = ((r"actions/workflows/tennisnote-public-ci\.yml/runs\?head_sha=[a-f0-9]{40}&event=pull_request&per_page=100", "RUN_LIST"),
        (r"actions/runs/[1-9][0-9]*", "RUN"), (r"actions/runs/[1-9][0-9]*/jobs\?per_page=100", "JOBS"),
        (r"pulls/[1-9][0-9]*", "PR"), (r"git/commits/[a-f0-9]{40}", "COMMIT"))
    role = next((name for pattern, name in allowed if isinstance(path, str) and re.fullmatch(pattern, path)), None)
    legacy_monthly_need(role is not None, "STATUS_GITHUB_PATH")
    token = os.environ.get("STATUS_GITHUB_TOKEN", "") if token is None else token
    legacy_monthly_need(isinstance(token, str) and bool(token), "STATUS_GITHUB_AUTH")
    request = urllib.request.Request(ROW_SCOPE_API + path, headers={"Accept": "application/vnd.github+json",
        "User-Agent": "TennisNote-DEV-source-check", "Authorization": "Bearer " + token})
    try:
        with (opener or urllib.request.build_opener(_NoRedirectHandler())).open(request, timeout=15) as response:
            legacy_monthly_need(response.status == 200, "STATUS_GITHUB_HTTP")
            data = response.read(1024 * 1024 + 1)
    except urllib.error.HTTPError as exc:
        status = int(exc.code); limited = status == 403 and exc.headers is not None and exc.headers.get("X-RateLimit-Remaining") == "0"; exc.close()
        fail("STATUS_GITHUB_" + role + ("_RATE_LIMIT" if limited else "_HTTP_" + str(status)))
    except (OSError, urllib.error.URLError, http.client.HTTPException):
        fail("STATUS_GITHUB_" + role + "_NETWORK")
    legacy_monthly_need(len(data) <= 1024 * 1024, "STATUS_GITHUB_SIZE")
    try:
        result = json.loads(data.decode("utf-8"))
    except (ValueError, UnicodeError):
        fail("STATUS_GITHUB_JSON")
    legacy_monthly_need(isinstance(result, dict), "STATUS_GITHUB_JSON")
    return result

def status_dev_github_jobs(run_id):
    legacy_monthly_need(type(run_id) is int and run_id > 0, "STATUS_JOB_ID")
    return status_dev_github_get(f"actions/runs/{run_id}/jobs?per_page=100")

def status_dev_ci(candidate):
    listing = status_dev_github_get("actions/workflows/tennisnote-public-ci.yml/runs?head_sha=" + candidate + "&event=pull_request&per_page=100")
    rows = listing.get("workflow_runs")
    legacy_monthly_need(isinstance(rows, list) and len(rows) < 100, "STATUS_CI_LIST")
    matches = [r for r in rows if isinstance(r, dict) and r.get("head_sha") == candidate and r.get("event") == "pull_request" and r.get("workflow_id") == 329932540]
    legacy_monthly_need(len(matches) == 1 and type(matches[0].get("id")) is int, "STATUS_CI_UNIQUE")
    run = status_dev_github_get("actions/runs/" + str(matches[0]["id"]))
    links = run.get("pull_requests")
    legacy_monthly_need(isinstance(links, list) and len(links) == 1 and type(links[0].get("number")) is int, "STATUS_CI_LINK")
    pr = status_dev_github_get("pulls/" + str(links[0]["number"]))
    head = status_dev_github_get("git/commits/" + candidate)
    parents = head.get("parents") if isinstance(head, dict) else None
    legacy_monthly_need(isinstance(parents, list) and len(parents) == 1
        and SHA40_RE.fullmatch(str(parents[0].get("sha", ""))) is not None, "STATUS_CI_SOURCE")
    legacy_monthly_need(parents[0]["sha"] == STATUS_DEV_CORRECTIVE, "STATUS_CI_CORRECTIVE")
    corrective = status_dev_github_get("git/commits/" + STATUS_DEV_CORRECTIVE)
    metadata_commit = status_dev_github_get("git/commits/" + STATUS_DEV_METADATA)
    source = status_dev_github_get("git/commits/" + STATUS_DEV_SOURCE)
    merge_sha = pr.get("merge_commit_sha")
    legacy_monthly_need(isinstance(merge_sha, str) and SHA40_RE.fullmatch(merge_sha), "STATUS_CI_MERGE")
    merge = status_dev_github_get("git/commits/" + merge_sha)
    return status_dev_ci_evidence(run, pr, head, corrective, metadata_commit, source, merge, status_dev_github_jobs(run["id"]), candidate)

def status_dev_source(candidate):
    corrective = run_git("show", "-s", "--format=%P", candidate)
    metadata_commit = run_git("show", "-s", "--format=%P", corrective)
    source = run_git("show", "-s", "--format=%P", metadata_commit)
    legacy_monthly_need(run_git("rev-parse", "HEAD") == candidate and run_git("status", "--porcelain", "--untracked-files=all") == ""
        and run_git("diff", "--cached", "--name-only") == "" and corrective == STATUS_DEV_CORRECTIVE and metadata_commit == STATUS_DEV_METADATA and source == STATUS_DEV_SOURCE
        and run_git("show", "-s", "--format=%P", source) == STATUS_DEV_BASE, "STATUS_SOURCE_GRAPH")
    raw = subprocess.check_output(["node", "-e", "const x=require('./scripts/check_r3_response_label_successor.cjs');process.stdout.write(JSON.stringify({pin:x.PIN,meta:x.META}))"], cwd=ROOT, text=True, timeout=15)
    contract = json.loads(raw); pins = contract.get("pin"); metadata = contract.get("meta")
    legacy_monthly_need(isinstance(pins, dict) and len(pins) == 15 and isinstance(metadata, list) and len(metadata) == 13
        and len(set(metadata)) == 13 and set(metadata).issubset(pins), "STATUS_PINS")
    allowed = set(pins) | STATUS_WIRING
    rows = [line.split("\t") for line in run_git("diff", "--no-renames", "--name-status", STATUS_DEV_BASE, candidate).splitlines()]
    legacy_monthly_need(len(rows) == len(allowed) and {r[1] for r in rows if len(r) == 2} == allowed, "STATUS_SOURCE_PATHS")
    source_paths = allowed - set(metadata)
    source_rows = [line.split("\t") for line in run_git("diff", "--no-renames", "--name-status", STATUS_DEV_BASE, source).splitlines()]
    metadata_rows = [line.split("\t") for line in run_git("diff", "--no-renames", "--name-status", source, metadata_commit).splitlines()]
    fix_rows = [line.split("\t") for line in run_git("diff", "--no-renames", "--name-status", metadata_commit, corrective).splitlines()]
    auth_rows = [line.split("\t") for line in run_git("diff", "--no-renames", "--name-status", corrective, candidate).splitlines()]
    legacy_monthly_need(len(source_rows) == len(source_paths) and {r[1] for r in source_rows if len(r) == 2} == source_paths
        and len(metadata_rows) == len(metadata) and {r[1] for r in metadata_rows if len(r) == 2} == set(metadata)
        and all(len(r) == 2 and r[0] == "M" for r in metadata_rows)
        and len(fix_rows) == len(STATUS_DEV_FIX) and {r[1] for r in fix_rows if len(r) == 2} == STATUS_DEV_FIX
        and all(len(r) == 2 and r[0] == "M" for r in fix_rows)
        and len(auth_rows) == len(STATUS_DEV_AUTH_FIX) and {r[1] for r in auth_rows if len(r) == 2} == STATUS_DEV_AUTH_FIX
        and all(len(r) == 2 and r[0] == "M" for r in auth_rows)
        and {(r[0], r[1]) for r in source_rows} == {(r[0], r[1]) for r in rows if r[1] in source_paths}, "STATUS_SOURCE_LAYERS")
    for status, name in rows:
        added = name in {"tests/r3-admin-response-label.test.js", "scripts/check_r3_response_label_successor.cjs", "tests/r3-response-label-successor-core.test.cjs", "scripts/collect_r3_response_label_pr.cjs", "tests/r3-response-label-collector.test.cjs", "tests/r3-response-label-deploy.test.py"}
        legacy_monthly_need(status == ("A" if added else "M") and run_git("ls-tree", "--format=%(objectmode)", candidate, "--", name) == "100644", "STATUS_SOURCE_MODE")
        if name in source_paths:
            legacy_monthly_need(run_git("ls-tree", "--format=%(objectmode)", source, "--", name) == "100644", "STATUS_SOURCE_LAYER_MODE")
        file = ROOT / name
        legacy_monthly_need(file.is_file() and not file.is_symlink(), "STATUS_SOURCE_FILE")
        legacy_monthly_need(all(not p.is_symlink() for p in file.parents if p == ROOT or ROOT in p.parents), "STATUS_SOURCE_SYMLINK")
        if name in pins:
            legacy_monthly_need(sha256(normalize_text(file.read_bytes())) == pins[name], "STATUS_SOURCE_HASH")
    release = json.loads((ROOT / "app/release.json").read_text(encoding="utf-8"))
    legacy_monthly_need(release.get("version") == release.get("appSurfaceVersion") == "1.0.571" and release.get("releaseId") == "2026.10.31.02", "STATUS_RELEASE")
    return release, source

def status_dev_target(env):
    expected, account, token = env.get("EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT", ""), env.get("CLOUDFLARE_ACCOUNT_ID", ""), env.get("CLOUDFLARE_API_TOKEN", "")
    legacy_monthly_need(SHA256_RE.fullmatch(expected) is not None and re.fullmatch(r"[a-f0-9]{32}", account) is not None
        and bool(token) and sha256(account.encode("utf-8")) == expected, "STATUS_ACCOUNT")
    result = {}
    for name in EXPECTED_PROJECTS:
        project = legacy_monthly_cloudflare_get(account, token, "pages/projects/" + name).get("result")
        legacy_monthly_need(isinstance(project, dict) and project.get("name") == name and project.get("production_branch") == "dev"
            and project.get("subdomain") == EXPECTED_PROJECT_DOMAINS[name] and isinstance(project.get("domains"), list)
            and all(isinstance(d, str) for d in project["domains"]) and EXPECTED_PROJECT_DOMAINS[name] in project["domains"]
            and not any(d in {"tennisnote-app.pages.dev", "tennisnote-admin.pages.dev"} for d in project["domains"]), "STATUS_TARGET")
        rows = legacy_monthly_cloudflare_get(account, token, "pages/projects/" + name + "/deployments?env=production&per_page=1").get("result")
        legacy_monthly_need(isinstance(rows, list), "STATUS_ROLLBACK")
        result[name] = rollback_proof(name, rows)
        legacy_monthly_need(result[name]["commit_sha"] == STATUS_DEV_BASE, "STATUS_ROLLBACK_SOURCE")
    return sha256(json.dumps(result, sort_keys=True, separators=(",", ":")).encode("utf-8"))

def status_dev_dispatch(args):
    env = dict(os.environ); candidate = env.get("TENNISNOTE_CANDIDATE_SHA", "")
    legacy_monthly_need(int(args.source_only) + int(args.live_preflight) == 1 and not args.branch_preflight
        and env.get("GITHUB_EVENT_NAME") == "workflow_dispatch" and env.get("GITHUB_REPOSITORY") == EXPECTED_REPOSITORY
        and env.get("GITHUB_REF") == "refs/heads/" + STATUS_DEV_BRANCH and env.get("GITHUB_REF_TYPE") == "branch"
        and env.get("GITHUB_WORKFLOW") == EXPECTED_WORKFLOW_NAME and env.get("GITHUB_RUN_ATTEMPT") == "1"
        and env.get("TENNISNOTE_WORKFLOW_REF") == EXPECTED_REPOSITORY + "/.github/workflows/deploy-cloudflare-pages-dev.yml@refs/heads/" + STATUS_DEV_BRANCH
        and SHA40_RE.fullmatch(candidate or "") is not None and candidate == env.get("GITHUB_SHA"), "STATUS_CONTEXT")
    os.environ["GIT_NO_LAZY_FETCH"] = "1"
    release, source = status_dev_source(candidate)
    ci = status_dev_ci(candidate)
    legacy_monthly_need(ci["tree"] == run_git("rev-parse", candidate + "^{tree}") and ci["source"] == source, "STATUS_CI_TREE")
    if args.live_preflight:
        legacy_monthly_artifacts({"release": release}, Path("dist/member-dev"), Path("dist/admin-dev"))
        legacy_monthly_need(normalize_text((ROOT / "dist/admin-dev/views/billing.js").read_bytes())
            == normalize_text((ROOT / "app/admin/views/billing.js").read_bytes()), "STATUS_ARTIFACT_PRODUCT")
        states = read_live_dev_states(candidate)
        for state in states:
            prior = state.get("release") or {}
            legacy_monthly_need(prior.get("version") == "1.0.570" and prior.get("releaseId") == "2026.10.31.01"
                and state.get("member_cache") == 603 and state.get("coach_cache") == 576, "STATUS_LIVE_BASELINE")
        verify_monotonic_release(release, 604, 577, states)
        for role in ("production_member_release", "production_admin_release", "production_pages_release"):
            live = _http_read(role, candidate)
            legacy_monthly_need(isinstance(live, dict) and live.get("version") == "1.0.561"
                and live.get("releaseId") == "2026.10.30.01", "STATUS_PROD_BASELINE")
        legacy_monthly_need(_cache_counter((ROOT / "dist/member-dev/service-worker.js").read_text(encoding="utf-8"), "tennis-note-member-pwa-") == 604
            and _cache_counter((ROOT / "dist/member-dev/tennis-note-coach-app/service-worker.js").read_text(encoding="utf-8"), "tennis-note-coach-mode-") == 577, "STATUS_ARTIFACT_CACHE")
        rollback = status_dev_target(env)
        print("STATUS_DEV_PREFLIGHT_PASS run_id=" + str(ci["runId"]) + " rollback_sha256=" + rollback)
    else:
        print("STATUS_SOURCE_AND_CI_PASS run_id=" + str(ci["runId"]))


# The 572 phone successor is separate from the immutable 571 validators above.
PHONE_DEV_PREDECESSOR = "470a2b9427eaf29aff9e6dd9b89ab608145dfa37"
PHONE_DEV_CORRECTIVE_BASE = "328a174047651a839910e2f678d9471bc762cdb0"
PHONE_DEV_BLOBLESS_BASE = "c52e19fa704fc57fa60eb3abdb60475b7aa131d3"
PHONE_DEV_PREDECESSOR_RUN = 41166580662

def phone_dev_ci_evidence(run, pr, head, merge, jobs, prior, prior_jobs, candidate):
    repo = EXPECTED_REPOSITORY
    legacy_monthly_need(isinstance(candidate, str) and SHA40_RE.fullmatch(candidate) is not None
        and isinstance(run, dict) and run.get("workflow_id") == 329932540
        and run.get("path") == ".github/workflows/tennisnote-public-ci.yml"
        and run.get("event") == "pull_request" and run.get("head_sha") == candidate
        and run.get("run_attempt") == 1 and run.get("status") == "completed" and run.get("conclusion") == "success"
        and (run.get("repository") or {}).get("full_name") == repo
        and (run.get("head_repository") or {}).get("full_name") == repo
        and type(run.get("id")) is int and run["id"] > 0, "PHONE_CI_RUN")
    links = run.get("pull_requests")
    legacy_monthly_need(isinstance(pr, dict) and pr.get("state") == "open" and pr.get("number") == 228
        and (pr.get("head") or {}).get("sha") == candidate and (pr.get("head") or {}).get("ref") == STATUS_DEV_BRANCH
        and ((pr.get("head") or {}).get("repo") or {}).get("full_name") == repo
        and (pr.get("base") or {}).get("sha") == STATUS_DEV_BASE and (pr.get("base") or {}).get("ref") == STATUS_DEV_PARENT
        and ((pr.get("base") or {}).get("repo") or {}).get("full_name") == repo
        and isinstance(links, list) and len(links) == 1 and links[0].get("number") == 228
        and (links[0].get("head") or {}).get("sha") == candidate and (links[0].get("base") or {}).get("sha") == STATUS_DEV_BASE, "PHONE_CI_PR")
    tree = (head.get("tree") or {}).get("sha") if isinstance(head, dict) else None
    legacy_monthly_need(isinstance(head, dict) and isinstance(merge, dict) and head.get("sha") == candidate
        and [x.get("sha") for x in head.get("parents", [])] == [PHONE_DEV_BLOBLESS_BASE]
        and merge.get("sha") == pr.get("merge_commit_sha")
        and [x.get("sha") for x in merge.get("parents", [])] == [STATUS_DEV_BASE, candidate]
        and SHA40_RE.fullmatch(str(tree or "")) is not None and tree == (merge.get("tree") or {}).get("sha"), "PHONE_CI_GRAPH")
    def admitted_job(data):
        entries = data.get("jobs") if isinstance(data, dict) else None
        if not isinstance(entries, list) or len(entries) != 1:
            return False
        job = entries[0]
        steps = job.get("steps") if isinstance(job, dict) else None
        return (job.get("name") == "build-and-check" and job.get("status") == "completed"
            and job.get("conclusion") == "success" and isinstance(steps, list)
            and sum(1 for step in steps if step.get("name") == "Admit exact response-label successor"
                and step.get("status") == "completed" and step.get("conclusion") == "success") == 1)
    legacy_monthly_need(admitted_job(jobs), "PHONE_CI_JOB")
    prior_links = prior.get("pull_requests") if isinstance(prior, dict) else None
    legacy_monthly_need(isinstance(prior, dict) and prior.get("id") == PHONE_DEV_PREDECESSOR_RUN
        and prior.get("workflow_id") == 329932540 and prior.get("path") == ".github/workflows/tennisnote-public-ci.yml"
        and prior.get("head_sha") == PHONE_DEV_PREDECESSOR and prior.get("event") == "pull_request"
        and prior.get("run_attempt") == 1 and prior.get("status") == "completed" and prior.get("conclusion") == "success"
        and (prior.get("repository") or {}).get("full_name") == repo
        and (prior.get("head_repository") or {}).get("full_name") == repo
        and isinstance(prior_links, list) and len(prior_links) == 1 and prior_links[0].get("number") == 228
        and (prior_links[0].get("head") or {}).get("sha") == candidate
        and (prior_links[0].get("base") or {}).get("sha") == STATUS_DEV_BASE and admitted_job(prior_jobs), "PHONE_PRIOR_CI")
    return {"runId": run["id"], "tree": tree}

def phone_dev_source(candidate):
    legacy_monthly_need(run_git("rev-parse", "HEAD") == candidate
        and run_git("show", "-s", "--format=%P", candidate) == PHONE_DEV_BLOBLESS_BASE
        and run_git("show", "-s", "--format=%P", PHONE_DEV_BLOBLESS_BASE) == PHONE_DEV_CORRECTIVE_BASE
        and run_git("show", "-s", "--format=%P", PHONE_DEV_CORRECTIVE_BASE) == PHONE_DEV_PREDECESSOR
        and run_git("status", "--porcelain", "--untracked-files=all") == ""
        and run_git("diff", "--cached", "--name-only") == "", "PHONE_SOURCE_GRAPH")
    raw = subprocess.check_output(["node", "-e", "const a=require('./scripts/check_r3_response_label_successor.cjs');const b=require('./scripts/collect_r3_response_label_pr.cjs');process.stdout.write(JSON.stringify({pin:a.PHONE_PIN,wire:b.PHONE_WIRING}))"], cwd=ROOT, text=True, timeout=15)
    contract = json.loads(raw); pins, wiring = contract.get("pin"), contract.get("wire")
    legacy_monthly_need(isinstance(pins, dict) and len(pins) == 15 and isinstance(wiring, list)
        and len(wiring) == 7 and len(set(wiring)) == 7 and not set(wiring).intersection(pins), "PHONE_PINS")
    rows = [line.split("\t") for line in run_git("diff", "--no-renames", "--name-status", PHONE_DEV_PREDECESSOR, candidate).splitlines()]
    allowed = set(pins) | set(wiring)
    legacy_monthly_need(len(rows) == len(allowed) and all(len(r) == 2 and r[0] == "M" for r in rows)
        and {r[1] for r in rows} == allowed, "PHONE_SOURCE_PATHS")
    for _, name in rows:
        file = ROOT / name
        legacy_monthly_need(run_git("ls-tree", "--format=%(objectmode)", candidate, "--", name) == "100644"
            and file.is_file() and not file.is_symlink()
            and all(not p.is_symlink() for p in file.parents if p == ROOT or ROOT in p.parents), "PHONE_SOURCE_MODE")
        if name in pins:
            legacy_monthly_need(sha256(normalize_text(file.read_bytes())) == pins[name], "PHONE_SOURCE_HASH")
    subprocess.check_call(["node", "-e", "const fs=require('fs'),cp=require('child_process'),c=require('./scripts/collect_r3_response_label_pr.cjs');const p=cp.execFileSync('git',['show','470a2b9427eaf29aff9e6dd9b89ab608145dfa37:.github/workflows/tennisnote-public-ci.yml'],{encoding:'utf8'}).replace(/\\r\\n/g,'\\n');if(c.wrapPhoneWorkflow(p)!==fs.readFileSync('.github/workflows/tennisnote-public-ci.yml','utf8').replace(/\\r\\n/g,'\\n'))process.exit(1)"], cwd=ROOT, timeout=15)
    release = json.loads((ROOT / "app/release.json").read_text(encoding="utf-8"))
    legacy_monthly_need(release.get("version") == release.get("appSurfaceVersion") == "1.0.572"
        and release.get("releaseId") == "2026.10.31.03", "PHONE_RELEASE")
    return release

def phone_dev_ci(candidate):
    listing = status_dev_github_get("actions/workflows/tennisnote-public-ci.yml/runs?head_sha=" + candidate + "&event=pull_request&per_page=100")
    rows = listing.get("workflow_runs")
    legacy_monthly_need(isinstance(rows, list) and len(rows) < 100, "PHONE_CI_LIST")
    matches = [r for r in rows if isinstance(r, dict) and r.get("head_sha") == candidate
        and r.get("event") == "pull_request" and r.get("workflow_id") == 329932540]
    legacy_monthly_need(len(matches) == 1 and type(matches[0].get("id")) is int, "PHONE_CI_UNIQUE")
    run = status_dev_github_get("actions/runs/" + str(matches[0]["id"]))
    pr = status_dev_github_get("pulls/228")
    head = status_dev_github_get("git/commits/" + candidate)
    merge_sha = pr.get("merge_commit_sha")
    legacy_monthly_need(isinstance(merge_sha, str) and SHA40_RE.fullmatch(merge_sha), "PHONE_CI_MERGE")
    merge = status_dev_github_get("git/commits/" + merge_sha)
    prior = status_dev_github_get("actions/runs/" + str(PHONE_DEV_PREDECESSOR_RUN))
    return phone_dev_ci_evidence(run, pr, head, merge, status_dev_github_jobs(run["id"]),
        prior, status_dev_github_jobs(PHONE_DEV_PREDECESSOR_RUN), candidate)

def phone_dev_target(env):
    expected, account, token = env.get("EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT", ""), env.get("CLOUDFLARE_ACCOUNT_ID", ""), env.get("CLOUDFLARE_API_TOKEN", "")
    legacy_monthly_need(SHA256_RE.fullmatch(expected) is not None and re.fullmatch(r"[a-f0-9]{32}", account) is not None
        and bool(token) and sha256(account.encode("utf-8")) == expected, "PHONE_ACCOUNT")
    result = {}
    for name in EXPECTED_PROJECTS:
        project = legacy_monthly_cloudflare_get(account, token, "pages/projects/" + name).get("result")
        legacy_monthly_need(isinstance(project, dict) and project.get("name") == name and project.get("production_branch") == "dev"
            and project.get("subdomain") == EXPECTED_PROJECT_DOMAINS[name] and isinstance(project.get("domains"), list)
            and all(isinstance(d, str) for d in project["domains"]) and EXPECTED_PROJECT_DOMAINS[name] in project["domains"]
            and not any(d in {"tennisnote-app.pages.dev", "tennisnote-admin.pages.dev"} for d in project["domains"]), "PHONE_TARGET")
        rows = legacy_monthly_cloudflare_get(account, token, "pages/projects/" + name + "/deployments?env=production&per_page=1").get("result")
        legacy_monthly_need(isinstance(rows, list), "PHONE_ROLLBACK")
        result[name] = rollback_proof(name, rows)
        legacy_monthly_need(result[name]["commit_sha"] == PHONE_DEV_PREDECESSOR, "PHONE_ROLLBACK_SOURCE")
    return sha256(json.dumps(result, sort_keys=True, separators=(",", ":")).encode("utf-8"))

def phone_dev_dispatch(args):
    env = dict(os.environ); candidate = env.get("TENNISNOTE_CANDIDATE_SHA", "")
    legacy_monthly_need(int(args.source_only) + int(args.live_preflight) == 1 and not args.branch_preflight
        and env.get("GITHUB_EVENT_NAME") == "workflow_dispatch" and env.get("GITHUB_REPOSITORY") == EXPECTED_REPOSITORY
        and env.get("GITHUB_REF") == "refs/heads/" + STATUS_DEV_BRANCH and env.get("GITHUB_REF_TYPE") == "branch"
        and env.get("GITHUB_WORKFLOW") == EXPECTED_WORKFLOW_NAME and env.get("GITHUB_RUN_ATTEMPT") == "1"
        and env.get("TENNISNOTE_WORKFLOW_REF") == EXPECTED_REPOSITORY + "/.github/workflows/deploy-cloudflare-pages-dev.yml@refs/heads/" + STATUS_DEV_BRANCH
        and SHA40_RE.fullmatch(candidate or "") is not None and candidate == env.get("GITHUB_SHA"), "PHONE_CONTEXT")
    os.environ["GIT_NO_LAZY_FETCH"] = "1"
    release = phone_dev_source(candidate)
    ci = phone_dev_ci(candidate)
    legacy_monthly_need(ci["tree"] == run_git("rev-parse", candidate + "^{tree}"), "PHONE_CI_TREE")
    if args.live_preflight:
        legacy_monthly_artifacts({"release": release}, Path("dist/member-dev"), Path("dist/admin-dev"))
        legacy_monthly_need(normalize_text((ROOT / "dist/admin-dev/domain/coaches.js").read_bytes())
            == normalize_text((ROOT / "app/admin/domain/coaches.js").read_bytes()), "PHONE_ARTIFACT_PRODUCT")
        states = read_live_dev_states(candidate)
        for state in states:
            prior = state.get("release") or {}
            legacy_monthly_need(prior.get("version") == "1.0.571" and prior.get("releaseId") == "2026.10.31.02"
                and state.get("member_cache") == 604 and state.get("coach_cache") == 577, "PHONE_LIVE_BASELINE")
        verify_monotonic_release(release, 605, 578, states)
        for role in ("production_member_release", "production_admin_release", "production_pages_release"):
            live = _http_read(role, candidate)
            legacy_monthly_need(isinstance(live, dict) and live.get("version") == "1.0.561"
                and live.get("releaseId") == "2026.10.30.01", "PHONE_PROD_BASELINE")
        legacy_monthly_need(_cache_counter((ROOT / "dist/member-dev/service-worker.js").read_text(encoding="utf-8"), "tennis-note-member-pwa-") == 605
            and _cache_counter((ROOT / "dist/member-dev/tennis-note-coach-app/service-worker.js").read_text(encoding="utf-8"), "tennis-note-coach-mode-") == 578, "PHONE_ARTIFACT_CACHE")
        rollback = phone_dev_target(env)
        print("PHONE_DEV_PREFLIGHT_PASS run_id=" + str(ci["runId"]) + " rollback_sha256=" + rollback)
    else:
        print("PHONE_SOURCE_AND_CI_PASS run_id=" + str(ci["runId"]))

def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-only", action="store_true")
    parser.add_argument("--live-preflight", action="store_true")
    parser.add_argument("--branch-preflight", action="store_true")
    args = parser.parse_args()
    try:
        if os.environ.get("GITHUB_REF") == "refs/heads/" + STATUS_DEV_BRANCH:
            candidate = os.environ.get("TENNISNOTE_CANDIDATE_SHA", "")
            if SHA40_RE.fullmatch(candidate or "") and run_git("show", "-s", "--format=%P", candidate) == PHONE_DEV_BLOBLESS_BASE:
                phone_dev_dispatch(args)
            else:
                status_dev_dispatch(args)
            return 0
        # CURRENT_TERM_DEV_570_ENTRY_BEGIN
        if os.environ.get("GITHUB_REF") == "refs/heads/" + CURRENT_TERM_DEV_BRANCH:
            try:
                current_term_dev_dispatch(args)
            except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError, KeyError, json.JSONDecodeError):
                fail("CURRENT_TERM_PREFLIGHT_HOLD")
            return 0
        # CURRENT_TERM_DEV_570_ENTRY_END
        # ROW_SCOPE_DEV_569_ENTRY_BEGIN
        if os.environ.get("GITHUB_REF") == "refs/heads/" + ROW_SCOPE_DEV_BRANCH:
            row_scope_dispatch(args)
            return 0
        # ROW_SCOPE_DEV_569_ENTRY_END
        # SUMMARY_LAYOUT_ENTRY_BEGIN
        if summary_layout_claimed():
            summary_layout_dispatch(args)
            return 0
        # SUMMARY_LAYOUT_ENTRY_END
        # LEGACY_MONTHLY_ENTRY_BEGIN
        if legacy_monthly_claimed():
            legacy_monthly_dispatch(args)
            return 0
        # LEGACY_MONTHLY_ENTRY_END
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
