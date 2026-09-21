#!/usr/bin/env python3
"""Build and verify the 2026-09-16 public dev/production alignment manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "docs" / "tennisnote-dev-prod-alignment-20260916.json"
AUTHORITY_SHA = "10489623686b29a133ed8e64e76f0587e78c9faf"
DEV_SHA = "14c2901f8c4278810d49c222d4adc09aaaa06ae2"
MERGE_BASE_SHA = "c7cd00d532a9edfa9bc420c631ea8547f00e84ea"

EXPECTED_VERSION = "1.0.510"
EXPECTED_RELEASE_ID = "2026.09.21.01"
EXPECTED_MEMBER_CACHE = "tennis-note-member-pwa-v549"
EXPECTED_COACH_CACHE = "tennis-note-coach-mode-v522"

SELECTED_NET_NEW_FEATURE_IDS = (
    "FEEDBACK-ADMIN-NOTE-PRESERVATION",
    "COACH-SERVER-FEEDBACK-PENDING-AUTHORITY",
    "AUTH-NATIVE-SESSION-CONTINUITY",
    "AUTH-EMAIL-UI-HIDDEN",
    "NATIVE-PUSH-FIREBASE-FAIL-CLOSED",
    "LEGACY-ARRAY-AT-COMPATIBILITY",
    "MEMBERSHIP-EFFECTIVE-STATE-PRIVATE-A7AA949C",
    "PUBLIC-STORE-AVAILABILITY-PRIVATE-EDFFC240",
    "SHARED-44PX-TARGETS-PRIVATE-EDFFC240",
    "PERSONAL-JOURNAL-MEDIA-CURRICULUM-PRIVATE-1A2019FA",
    "PERSONAL-JOURNAL-OWN-PROFILE-PRIVATE-D3CF3A8F",
)
SELECTED_NET_NEW_PATHS = {
    "app/shared/tennisnote-personal-journal.js",
    "app/tennis-note-member-app/actions/journal.js",
    "app/tennis-note-member-app/data/journal.js",
    "app/tennis-note-member-app/views/journal.js",
    "app/tennis-note-member-app/ui/screens.js",
    "app/tennis-note-member-app/events/schedule.js",
    "app/tennis-note-member-app/service-worker.js",
    "app/tennis-note-member-app/settings.js",
    "app/tennis-note-coach-app/domain/curriculum.js",
    "app/release.json",
    "app/shared/tennisnote-release.js",
    "app/shared/tennisnote-release-updater.js",
    "app/shared/tennisnote-ui-foundation.css",
    "app/admin/actions/coach.js",
    "app/admin/actions/common.js",
    "app/admin/app.js",
    "app/admin/domain/coaches.js",
    "app/admin/domain/tickets.js",
    "app/admin/forms/schedule.js",
    "app/admin/schedule-v2-admin.js",
    "app/shared/tennisnote-comment-draft.js",
    "app/shared/tennisnote-data-client.js",
    "app/shared/tennisnote-single-sheet-preview-ui.js",
    "app/shared/tennisnote-native-push.js",
    "app/shared/tennisnote-issue-reporter.js",
    "app/shared/tennisnote-runtime-environment.js",
    "app/shared/tennisnote-ui-language.js",
    "app/shared/tennisnote-ticket-state.js",
    "app/tennis-note-coach-app/actions/schedule.js",
    "app/tennis-note-coach-app/app.js",
    "app/tennis-note-coach-app/data/auth.js",
    "app/tennis-note-coach-app/data/push.js",
    "app/tennis-note-coach-app/domain/records.js",
    "app/tennis-note-coach-app/domain/members.js",
    "app/tennis-note-coach-app/forms/coaches.js",
    "app/tennis-note-coach-app/forms/common.js",
    "app/tennis-note-coach-app/settings.js",
    "app/tennis-note-coach-app/views/home.js",
    "app/tennis-note-member-app/actions/session.js",
    "app/tennis-note-member-app/app.js",
    "app/tennis-note-member-app/data/auth.js",
    "app/tennis-note-member-app/data/push.js",
    "app/tennis-note-member-app/domain/common.js",
    "app/tennis-note-member-app/domain/identity.js",
    "app/tennis-note-member-app/domain/journal.js",
    "app/tennis-note-member-app/domain/purchase.js",
    "app/tennis-note-member-app/domain/schedule.js",
    "app/tennis-note-member-app/domain/tickets.js",
    "app/tennis-note-member-app/forms/common.js",
    "app/tennis-note-member-app/forms/members.js",
    "app/tennis-note-member-app/forms/schedule.js",
    "app/tennis-note-member-app/index.html",
}

DEV_WORKFLOW = ".github/workflows/deploy-cloudflare-pages-dev.yml"
DEV_WORKFLOW_LINES = (
    "      TENNISNOTE_SINGLE_SHEET_IMPORT_MODE: apply",
    '      TENNISNOTE_SINGLE_SHEET_IMPORT_REVERSE_ENABLED: "true"',
    "          grep -q '\"singleSheetImportMode\": \"apply\"' dist/admin-dev/shared/config.local.js",
    "          grep -q '\"singleSheetImportReverseEnabled\": true' dist/admin-dev/shared/config.local.js",
)

INCOMPLETE = {
    "387cf49": ("R3-SETTLEMENT-SNAPSHOT", "R3 monthly settlement close is outside this release."),
    "8613cf0": ("R3-SETTLEMENT-RECONCILIATION", "R3 coach settlement reconciliation is outside this release."),
    "e133386": ("R2-COACH-EXACT-MAKEUP-BOOKING", "Actual Android save remains not verified."),
    "8227acb": ("R2-FUTURE-GROUP-PARTICIPANT-ABSENCE", "Production policy and device gate remain open."),
    "88375d0": ("AUTH-SIGNUP-LINK-APPROVAL", "Production permission and rollout gate remain open."),
}

UNSAFE_UNKNOWN = {
    "7ddd4ba": (
        "R2-PARTIAL-REFUND-SETTLEMENT-ADJUSTMENT",
        "The production settlement dependency was not proven for this isolated release.",
    ),
}

DEV_ONLY = {
    "227dae9": (
        "DEV-BANNER-MODAL-INSET",
        "Development-only banner behavior; production product authority is retained.",
    ),
}

PRODUCTION_AUTHORITY_FEATURE_IDS = (
    "AUTH-PHONE-CAPABILITY-GUARD",
    "AUTH-IOS-FOCUS-16PX",
    "P0-VERIFIED-TICKET-RECOVERY",
    "R1-PWA-STABILIZATION",
    "R2-ATTENDANCE-FEEDBACK-EXACT-TICKET",
    "EXCEL-SINGLE-SHEET-IMPORT",
    "NATIVE-SYSTEM-INSETS",
    "AUTH-NATIVE-OAUTH-CALLBACK",
    "PURCHASE-PICKER-FAMILY-RESELECTION",
    "BRANCH-LABELS-SIGNUP-PHONE",
    "RECORD-TABS-TOUCH-ORIENTATION",
    "TICKET-POLICY-HISTORY",
    "PAYMENT-KAKAOPAY-CONFIG",
    "PURCHASE-LEGACY-CONFLICT-GUARD",
    "PAYMENT-METHOD-GROUPS",
    "MEMBERSHIP-WEEKLY-FREQUENCY",
    "MEMBER-REFUND-REQUEST",
)


def run_git(*args: str, text: bool = True) -> str | bytes:
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=text,
        encoding="utf-8" if text else None,
    )
    return result.stdout


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def authority_bytes(path: str) -> bytes:
    return run_git("show", f"{AUTHORITY_SHA}:{path}", text=False)


def authority_paths(prefix: str) -> list[str]:
    output = run_git("ls-tree", "-r", "--name-only", AUTHORITY_SHA, prefix)
    return sorted(line for line in str(output).splitlines() if line)


def release_metadata(path: Path) -> dict[str, str]:
    data = json.loads(path.read_text(encoding="utf-8"))
    return {
        "version": str(data["version"]),
        "release_id": str(data["releaseId"]),
        "deployed_at": str(data["deployedAt"]),
    }


def normalize_product_bytes(path: str, data: bytes, manifest: dict[str, object]) -> bytes:
    try:
        text = data.decode("utf-8").replace("\r\n", "\n")
    except UnicodeDecodeError:
        return data

    authority = manifest["authority_release"]
    candidate = manifest["candidate_release"]
    replacements = (
        (str(authority["version"]), "<APP_VERSION>"),
        (str(candidate["version"]), "<APP_VERSION>"),
        (str(authority["release_id"]), "<RELEASE_ID>"),
        (str(candidate["release_id"]), "<RELEASE_ID>"),
        (str(authority["deployed_at"]), "<DEPLOYED_AT>"),
        (str(candidate["deployed_at"]), "<DEPLOYED_AT>"),
        (str(authority["member_cache"]), "<MEMBER_CACHE>"),
        (str(candidate["member_cache"]), "<MEMBER_CACHE>"),
        (str(authority["coach_cache"]), "<COACH_CACHE>"),
        (str(candidate["coach_cache"]), "<COACH_CACHE>"),
    )
    for source, token in replacements:
        if source:
            text = text.replace(source, token)
    return text.encode("utf-8")


def workflow_normalized(data: bytes) -> bytes:
    text = data.decode("utf-8").replace("\r\n", "\n")
    lines = [line for line in text.splitlines() if line not in DEV_WORKFLOW_LINES]
    return ("\n".join(lines) + "\n").encode("utf-8")


def classify_commits() -> list[dict[str, str]]:
    output = str(
        run_git(
            "log",
            "--reverse",
            "--format=%H%x1f%s",
            f"{MERGE_BASE_SHA}..{DEV_SHA}",
        )
    )
    entries: list[dict[str, str]] = []
    for line in output.splitlines():
        if not line:
            continue
        commit, subject = line.split("\x1f", 1)
        short = commit[:7]
        if short in INCOMPLETE:
            feature_id, reason = INCOMPLETE[short]
            category = "incomplete"
            decision = "exclude"
        elif short in UNSAFE_UNKNOWN:
            feature_id, reason = UNSAFE_UNKNOWN[short]
            category = "unsafe/unknown"
            decision = "exclude"
        elif short in DEV_ONLY:
            feature_id, reason = DEV_ONLY[short]
            category = "dev-only"
            decision = "exclude"
        elif subject.startswith(("chore", "Merge ")):
            feature_id = "RELEASE-OR-HISTORY-ONLY"
            reason = "Release metadata or merge history is not a product promotion unit."
            category = "dev-only"
            decision = "exclude"
        else:
            feature_id = f"DEV-COMMIT-{short.upper()}"
            reason = "Completed behavior is already represented by the production authority tree."
            category = "promote-ready"
            decision = "authority-already-contains"
        entries.append(
            {
                "sha": commit,
                "subject": subject,
                "feature_id": feature_id,
                "category": category,
                "decision": decision,
                "reason": reason,
            }
        )
    if len(entries) != 93:
        raise RuntimeError(f"expected 93 dev-ahead commits, found {len(entries)}")
    return entries


def candidate_cache(path: Path) -> str:
    match = re.search(r'^const CACHE_NAME = "([^"]+)";', path.read_text(encoding="utf-8"), re.M)
    if not match:
        raise RuntimeError(f"CACHE_NAME not found: {path}")
    return match.group(1)


def generate() -> None:
    authority_release = json.loads(
        authority_bytes("app/release.json").decode("utf-8")
    )
    candidate = release_metadata(ROOT / "app" / "release.json")
    manifest: dict[str, object] = {
        "contract_version": 1,
        "authority": {
            "production_sha": AUTHORITY_SHA,
            "development_sha": DEV_SHA,
            "merge_base_sha": MERGE_BASE_SHA,
        },
        "authority_release": {
            "version": authority_release["version"],
            "release_id": authority_release["releaseId"],
            "deployed_at": authority_release["deployedAt"],
            "member_cache": "tennis-note-member-pwa-v512",
            "coach_cache": "tennis-note-coach-mode-v485",
        },
        "candidate_release": {
            **candidate,
            "member_cache": candidate_cache(ROOT / "app" / "tennis-note-member-app" / "service-worker.js"),
            "coach_cache": candidate_cache(ROOT / "app" / "tennis-note-coach-app" / "service-worker.js"),
        },
        "allowed_differences": [
            "app version literals",
            "release id and deployed-at literals",
            "member and coach service-worker cache names",
            "generated config.local.js values",
            "the exact four development deployment workflow lines",
        ],
        "production_authority_feature_ids": list(PRODUCTION_AUTHORITY_FEATURE_IDS),
        "selected_net_new_dev_feature_ids": list(SELECTED_NET_NEW_FEATURE_IDS),
        "selection_note": (
            "Only the verified feedback fixes, native authentication session continuity, hidden "
            "email authentication entry points, push fail-closed behavior, and legacy Array "
            "compatibility plus the strictly source-verified membership effective-state change "
            "from private a7aa949c2db64edd1fbfb665b8a8cf03690e8160 are added beyond the "
            "production authority tree. The production hotfix base is "
            "3d215f7da47fc6f002e77d420f1682c848c93e40. Development 1.0.509 adds only "
            "source-verified store availability and shared 44px contracts from private "
            "edffc240eb5123dd4a4e771986073b0255f2d142; existing hash assertions remain exact. "
            "Personal journal and curriculum changes match private "
            "1a2019fade5048794668159957463aa4a08ad7c2; the own-profile authorization and "
            "read-preservation correction matches private d3cf3a8f64d18feb00492dd06c9aad5df1ec4368 "
            "through the separate exact-function/shared hash manifest."
        ),
        "dev_ahead_commits": classify_commits(),
    }
    paths = sorted(set(authority_paths("app")) | {"app/shared/tennisnote-personal-journal.js"})
    placeholder = dict(manifest)
    hashes = {
        path: sha256(
            normalize_product_bytes(
                path,
                (ROOT / path).read_bytes() if path in SELECTED_NET_NEW_PATHS else authority_bytes(path),
                placeholder,
            )
        )
        for path in paths
    }
    manifest["product_tree"] = {
        "file_count": len(paths),
        "normalized_sha256_by_path": hashes,
    }
    manifest["development_workflow"] = {
        "path": DEV_WORKFLOW,
        "authority_sha256_without_dev_lines": sha256(workflow_normalized(authority_bytes(DEV_WORKFLOW))),
        "required_exact_lines": list(DEV_WORKFLOW_LINES),
    }
    MANIFEST_PATH.parent.mkdir(parents=True, exist_ok=True)
    MANIFEST_PATH.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {MANIFEST_PATH.relative_to(ROOT)} with {len(paths)} product files and 93 commit classifications")


def verify() -> None:
    manifest = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))
    candidate = manifest["candidate_release"]
    if candidate["version"] != EXPECTED_VERSION or candidate["release_id"] != EXPECTED_RELEASE_ID:
        raise RuntimeError("manifest candidate version/release does not match the approved release")
    if candidate["member_cache"] != EXPECTED_MEMBER_CACHE or candidate["coach_cache"] != EXPECTED_COACH_CACHE:
        raise RuntimeError("manifest candidate cache names do not match approved monotonic floors")

    current_release = release_metadata(ROOT / "app" / "release.json")
    if current_release != {key: candidate[key] for key in ("version", "release_id", "deployed_at")}:
        raise RuntimeError("current release metadata differs from alignment manifest")
    if candidate_cache(ROOT / "app" / "tennis-note-member-app" / "service-worker.js") != EXPECTED_MEMBER_CACHE:
        raise RuntimeError("member cache is not the approved monotonic value")
    if candidate_cache(ROOT / "app" / "tennis-note-coach-app" / "service-worker.js") != EXPECTED_COACH_CACHE:
        raise RuntimeError("coach cache is not the approved monotonic value")

    expected_hashes = manifest["product_tree"]["normalized_sha256_by_path"]
    actual_paths = sorted(
        path.relative_to(ROOT).as_posix()
        for path in (ROOT / "app").rglob("*")
        if path.is_file() and path.name != "config.local.js"
    )
    if actual_paths != sorted(expected_hashes):
        missing = sorted(set(expected_hashes) - set(actual_paths))
        extra = sorted(set(actual_paths) - set(expected_hashes))
        raise RuntimeError(f"product path drift: missing={missing[:5]} extra={extra[:5]}")
    mismatches = []
    for path in actual_paths:
        data = (ROOT / path).read_bytes()
        current_hash = sha256(normalize_product_bytes(path, data, manifest))
        if current_hash != expected_hashes[path]:
            mismatches.append(path)
    if mismatches:
        raise RuntimeError(f"product hash drift outside approved literals: {mismatches[:20]}")

    workflow = (ROOT / DEV_WORKFLOW).read_bytes()
    workflow_text = workflow.decode("utf-8").replace("\r\n", "\n")
    for line in DEV_WORKFLOW_LINES:
        if workflow_text.splitlines().count(line) != 1:
            raise RuntimeError(f"development workflow line missing or duplicated: {line}")
    expected_workflow_hash = manifest["development_workflow"]["authority_sha256_without_dev_lines"]
    if sha256(workflow_normalized(workflow)) != expected_workflow_hash:
        raise RuntimeError("development workflow differs from production beyond the approved four lines")

    entries = manifest["dev_ahead_commits"]
    if len(entries) != 93:
        raise RuntimeError("promotion manifest must classify exactly 93 dev-ahead commits")
    categories = {entry["category"] for entry in entries}
    if categories != {"promote-ready", "dev-only", "incomplete", "unsafe/unknown"}:
        raise RuntimeError(f"promotion categories incomplete: {sorted(categories)}")
    print(
        "alignment PASS: "
        f"{len(actual_paths)} product files, 93 commits classified, "
        f"{candidate['version']} / {candidate['release_id']} / "
        f"{candidate['member_cache']} / {candidate['coach_cache']}"
    )


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--generate", action="store_true")
    args = parser.parse_args()
    try:
        generate() if args.generate else verify()
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError, KeyError, json.JSONDecodeError) as exc:
        print(f"alignment FAIL: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
