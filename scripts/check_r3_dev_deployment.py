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


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-only", action="store_true")
    parser.add_argument("--live-preflight", action="store_true")
    parser.add_argument("--branch-preflight", action="store_true")
    args = parser.parse_args()
    try:
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
