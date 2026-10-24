#!/usr/bin/env python3
"""기존 DEV Pages만 읽기 검증하며 실패 사유에 비밀값을 포함하지 않는다."""
from __future__ import annotations

import hashlib
import json
import os
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import check_tennisnote_dev_prod_alignment as release_alignment

ROOT = Path(__file__).resolve().parents[1]
PROJECTS = ("tennisnote-app-dev", "tennisnote-admin-dev")
DEV_PROJECT_FINGERPRINT = "63350140ffe5"
REPOSITORY = "leisurewang0827/tennis-note-public"
CALLER_WORKFLOW = REPOSITORY + "/.github/workflows/tennisnote-public-ci.yml@refs/heads/dev"


class ScopeError(RuntimeError):
    pass


def require(condition: bool, reason: str) -> None:
    if not condition:
        raise ScopeError(reason)


def validate_context(env: dict[str, str], head: str) -> tuple[str, str]:
    require(env.get("GITHUB_REPOSITORY") == REPOSITORY
            and env.get("TENNISNOTE_CALLER_WORKFLOW_REF") == CALLER_WORKFLOW,
            "development_caller_mismatch")
    require(env.get("GITHUB_EVENT_NAME") == "push" and env.get("GITHUB_REF") == "refs/heads/dev"
            and bool(re.fullmatch(r"[a-f0-9]{40}", head)) and env.get("GITHUB_SHA") == head,
            "development_source_context_mismatch")
    require(env.get("TENNISNOTE_ENVIRONMENT") == "development"
            and env.get("TENNISNOTE_PAYMENTS_ENABLED") == "false"
            and env.get("TENNISNOTE_PAYMENT_MODE") == "disabled"
            and env.get("TENNISNOTE_BANK_TRANSFER_ENABLED") == "false"
            and env.get("TENNISNOTE_ALLOWED_PAYMENT_METHODS", "") == "",
            "development_runtime_mismatch")
    url = env.get("TENNISNOTE_SUPABASE_URL", "").strip().lower().rstrip("/")
    match = re.fullmatch(r"https://([a-z0-9-]+)\.supabase\.co", url)
    require(bool(match), "development_project_unconfirmed")
    fingerprint = hashlib.sha256(match.group(1).encode()).hexdigest()
    require(fingerprint.startswith(DEV_PROJECT_FINGERPRINT), "development_project_mismatch")
    account = env.get("CLOUDFLARE_ACCOUNT_ID", "")
    expected = env.get("EXPECTED_CLOUDFLARE_ACCOUNT_FINGERPRINT", "")
    require(bool(re.fullmatch(r"[a-f0-9]{64}", expected)), "development_account_fingerprint_missing")
    require(bool(re.fullmatch(r"[a-f0-9]{32}", account)) and
            hashlib.sha256(account.encode()).hexdigest() == expected,
            "development_account_mismatch")
    require(bool(env.get("CLOUDFLARE_API_TOKEN")), "development_api_access_missing")
    return account, expected


def verify_existing_projects(get) -> dict[str, str]:
    rollbacks = {}
    for name in PROJECTS:
        result = get("/pages/projects/" + name)
        require(result.get("success") is True and isinstance(result.get("result"), dict),
                "development_project_presence_unconfirmed")
        project = result["result"]
        require(project.get("name") == name and project.get("production_branch") == "dev",
                "development_pages_branch_mismatch")
        result = get("/pages/projects/" + name + "/deployments?env=production&per_page=1")
        require(result.get("success") is True and isinstance(result.get("result"), list)
                and len(result["result"]) == 1, "development_rollback_unconfirmed")
        deployment = result["result"][0]
        require(deployment.get("environment") == "production"
                and deployment.get("latest_stage", {}).get("status") == "success"
                and deployment.get("deployment_trigger", {}).get("metadata", {}).get("branch") == "dev"
                and bool(re.fullmatch(r"[a-f0-9-]{36}", str(deployment.get("id", "")))),
                "development_rollback_unconfirmed")
        rollbacks[name] = deployment["id"]
    return rollbacks


def validate_frozen_release_metadata(raw_release_text: str, frozen_release: dict) -> dict[str, str]:
    raw_release = json.loads(raw_release_text)
    payout_candidate = json.loads(raw_release_text)
    is_payout_candidate = (payout_candidate.get("version") == "1.0.554"
                           and payout_candidate.get("releaseId") == "2026.10.24.02")
    payout_base = release_alignment.restore_r3_manual_payout_successor_base(
        "app/release.json", raw_release_text, strict=is_payout_candidate
    )
    comparison_text = release_alignment.restore_r3_basic_settlement_successor_base(
        "app/release.json", payout_base
    )
    comparison_release = json.loads(comparison_text)
    require(comparison_release["version"] == frozen_release["version"]
            and comparison_release["releaseId"] == frozen_release["releaseId"],
            "development_release_mismatch")
    # The check is normalized to the frozen Auth baseline; deployment still reports the raw candidate.
    return {"version": str(raw_release["version"]), "releaseId": str(raw_release["releaseId"])}


def validate_source() -> dict:
    port = json.loads((ROOT / "tests/fixtures/verified-profile-phone-source-parity.json").read_text(encoding="utf-8"))
    for row in port["authReconciliation"]["files"]:
        source = (ROOT / row["path"]).read_text(encoding="utf-8").replace("\r\n", "\n")
        current = next((item for item in port["sessionLoss"]["files"] if item["path"] == row["path"]), row)
        require(hashlib.sha256(source.encode()).hexdigest() == current["afterFileSha256"], "auth_source_parity_mismatch")
    freeze = json.loads((ROOT / "tests/fixtures/auth-only-development-prepare-source-parity.json").read_text(encoding="utf-8"))
    raw_release_text = (ROOT / "app/release.json").read_text(encoding="utf-8")
    return validate_frozen_release_metadata(raw_release_text, freeze["release"])


def verify_development_checkout_history(head: str) -> None:
    """Fail closed before Cloudflare reads if the checked-out commit's parent is unavailable."""
    full_sha = re.compile(r"[a-f0-9]{40}")
    require(bool(full_sha.fullmatch(head)), "development_scope_unconfirmed")
    ancestry = str(release_alignment.run_git("rev-list", "--parents", "-n", "1", head)).split()
    require(len(ancestry) == 2 and ancestry[0] == head and bool(full_sha.fullmatch(ancestry[1])),
            "development_scope_unconfirmed")
    parent = ancestry[1]
    parent_ancestry = str(release_alignment.run_git("rev-list", "--parents", "-n", "1", parent)).split()
    require(bool(parent_ancestry) and parent_ancestry[0] == parent,
            "development_scope_unconfirmed")


def main() -> int:
    try:
        head = subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip()
        account, fingerprint = validate_context(dict(os.environ), head)
        verify_development_checkout_history(head)
        release = validate_source()
        token = os.environ["CLOUDFLARE_API_TOKEN"]

        def get(suffix):
            request = urllib.request.Request("https://api.cloudflare.com/client/v4/accounts/" +
                urllib.parse.quote(account, safe="") + suffix, headers={"Authorization": "Bearer " + token})
            try:
                with urllib.request.urlopen(request, timeout=20) as response:
                    return json.load(response)
            except Exception:
                raise ScopeError("development_api_read_unconfirmed") from None

        rollbacks = verify_existing_projects(get)
        print(json.dumps({"status": "PASS", "repository": REPOSITORY, "callerWorkflow": CALLER_WORKFLOW, "accountFingerprint": fingerprint,
              "projectFingerprint": DEV_PROJECT_FINGERPRINT, "source": head, "release": release,
              "rollbackDeployments": rollbacks}, sort_keys=True))
        return 0
    except ScopeError as error:
        print("DEPLOY_SCOPE_FAIL:" + str(error), file=sys.stderr)
    except Exception:
        print("DEPLOY_SCOPE_FAIL:development_scope_unconfirmed", file=sys.stderr)
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
