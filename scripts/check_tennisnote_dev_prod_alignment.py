#!/usr/bin/env python3
"""Build and verify the 2026-09-16 public dev/production alignment manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
from collections import OrderedDict
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
MANIFEST_PATH = ROOT / "docs" / "tennisnote-dev-prod-alignment-20260916.json"
AUTHORITY_SHA = "10489623686b29a133ed8e64e76f0587e78c9faf"
DEV_SHA = "14c2901f8c4278810d49c222d4adc09aaaa06ae2"
MERGE_BASE_SHA = "c7cd00d532a9edfa9bc420c631ea8547f00e84ea"
R3_SUCCESSOR_AUTHORITY_PATH = ROOT / "tests" / "fixtures" / "r3-basic-settlement-549-successor-authority.json"
R3_SUCCESSOR_BASE_SHA = "582ebd00f31654233ecc77c1bf2efdd4fde0beec"
R3_SUCCESSOR_CANDIDATE_SHA = "3f52094ad45979ceb5a732d56aaca1445f5ecae6"
R3_SUCCESSOR_TARGET = "public-dev"
R3_SUCCESSOR_BRANCH = "dev"
R3_POLICY_550_AUTHORITY_PATH = ROOT / "tests" / "fixtures" / "r3-coach-schedule-policy-550-successor-authority.json"
R3_POLICY_550_BASE_SHA = "20fec3232cf66b99f16f5edebee8aa7d9843405a"
R3_POLICY_550_EXPECTED_PATHS = frozenset({
    "app/admin/actions/coach.js",
    "app/admin/data/schedule.js",
    "app/admin/index.html",
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
})
R3_POLICY_550_FEATURE_PATHS = frozenset({
    "app/admin/actions/coach.js",
    "app/admin/data/schedule.js",
})
R3_POLICY_550_RELEASE_PATHS = R3_POLICY_550_EXPECTED_PATHS - R3_POLICY_550_FEATURE_PATHS
R3_POLICY_551_AUTHORITY_PATH = ROOT / "tests" / "fixtures" / "r3-coach-settlement-input-551-successor-authority.json"
R3_POLICY_551_BASE_SHA = "8bb7b3fe3f13904203b7eccd5946104ddf34fa15"
R3_POLICY_551_FEATURE_PATHS = frozenset({
    "app/admin/domain/coaches.js",
    "app/admin/forms/coach.js",
})
R3_POLICY_551_RELEASE_PATHS = frozenset({
    "app/admin/index.html",
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
})
R3_POLICY_551_EXPECTED_PATHS = R3_POLICY_551_FEATURE_PATHS | R3_POLICY_551_RELEASE_PATHS
R3_POLICY_552_AUTHORITY_PATH = ROOT / "tests" / "fixtures" / "r3-coach-settlement-input-552-successor-authority.json"
R3_POLICY_552_BASE_SHA = "bd384cd0182bfc51dcc56fce0de03da2c011126b"
R3_POLICY_552_FEATURE_PATHS = frozenset({
    "app/admin/views/settings.js",
    "tests/coach-staff-settlement-readback.test.js",
})
R3_POLICY_552_RELEASE_PATHS = frozenset({
    "app/admin/index.html",
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
})
R3_POLICY_552_CONTENT_PATHS = frozenset({
    "app/admin/views/settings.js",
    *R3_POLICY_552_RELEASE_PATHS,
})
R3_POLICY_552_EXPECTED_PATHS = R3_POLICY_552_FEATURE_PATHS | R3_POLICY_552_RELEASE_PATHS
R3_MANUAL_PAYOUT_SOURCE_AUTHORITY_PATH = ROOT / "tests" / "fixtures" / "r3-manual-payout-port-source-authority.json"
R3_MANUAL_PAYOUT_BASE_SHA = "636bdb571dab9d67e18725cd101f0fbe452d69d7"
R3_MANUAL_PAYOUT_FEATURE_SHA = "758feca68b3dcc7df89652c0dda03176e1c2dc16"
R3_MANUAL_PAYOUT_CANDIDATE_SHA = "1b1a73ce73ea2998ed91b54d52aa312d6a2d47f6"
R3_MANUAL_PAYOUT_FEATURE_PATHS = frozenset({
    "app/admin/actions/billing.js",
    "app/admin/data/billing.js",
    "app/admin/events/billing.js",
    "app/admin/index.html",
    "app/admin/views/billing.js",
    "app/tennis-note-coach-app/data/sync.js",
    "app/tennis-note-coach-app/views/settlement.js",
    "tests/fixtures/r3-manual-payout-port-source-authority.json",
    "tests/r3-manual-payout-port.test.js",
})
R3_MANUAL_PAYOUT_RELEASE_PATHS = frozenset({
    "app/admin/index.html",
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
})
R3_MANUAL_PAYOUT_EXPECTED_PATHS = R3_MANUAL_PAYOUT_FEATURE_PATHS | R3_MANUAL_PAYOUT_RELEASE_PATHS
R3_MANUAL_PAYOUT_SOURCE_PATHS = frozenset(path for path in R3_MANUAL_PAYOUT_EXPECTED_PATHS if path.startswith("app/"))
R3_SUCCESSOR_EXPECTED_PATHS = frozenset({
    "app/admin/actions/coach.js",
    "app/admin/domain/coaches.js",
    "app/admin/index.html",
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
})

EXPECTED_VERSION = "1.0.546"
EXPECTED_RELEASE_ID = "2026.10.09.03"
EXPECTED_MEMBER_CACHE = "tennis-note-member-pwa-v583"
EXPECTED_COACH_CACHE = "tennis-note-coach-mode-v556"

SELECTED_NET_NEW_FEATURE_IDS = (
    "MONTH-MEDIA-LABEL-PRIVATE-060ECE0E",
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
    "AUTH-PHONE-EXISTS-GUIDANCE-PRIVATE-92C72E4C",
    "REQUIRED-PRODUCT-FAMILY-LABELS-PRIVATE-6FDBACAE",
    "PERSONAL-JOURNAL-LONG-VIDEO-PRIVATE-C5884FAB",
    "PERSONAL-JOURNAL-VALIDATION-MEDIA-EXIT-PRIVATE-E2333BAE",
    "PERSONAL-JOURNAL-HEVC-FASTSTART-PRIVATE-4F615940",
    "PERSONAL-JOURNAL-MEDIA-REENTRY-PRIVATE-F408DAE5",
    "AUTH-PROFILE-COMPLETION-SERVER-AUTHORITY-PRIVATE-46CC06FF",
    "CUR02-05-BRIEFING2-LOCAL-OVERLAY",
    "PERSONAL-JOURNAL-OS-TEXT-SHARE",
)
SELECTED_NET_NEW_PATHS = {
    "app/shared/tennisnote-curriculum-contract.js",
    "app/shared/tennisnote-curriculum-reader.js",
    "app/shared/tennisnote-curriculum-search.js",
    "app/shared/tennisnote-curriculum-ui.js",
    "app/tennis-note-member-app/domain/curriculum.js",
    "app/tennis-note-member-app/styles.css",
    "app/tennis-note-member-app/views/common.js",
    "app/tennis-note-member-app/views/curriculum.js",
    "app/admin/actions/member.js",
    "app/admin/actions/settings.js",
    "app/admin/domain/policy.js",
    "app/admin/forms/tickets.js",
    "app/admin/ui/common.js",
    "app/shared/tennisnote-product-catalog.js",
    "app/tennis-note-coach-app/domain/settlement.js",
    "app/tennis-note-coach-app/data/records.js",
    "app/tennis-note-coach-app/events/delegated.js",
    "app/tennis-note-member-app/catalog.js",
    "app/tennis-note-member-app/domain/products.js",
    "app/tennis-note-member-app/events/delegated.js",
    "app/tennis-note-member-app/ui/common.js",
    "app/shared/tennisnote-personal-journal.js",
    "app/shared/tennisnote-mp4-faststart.js",
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
    "app/tennis-note-member-app/data/payment.js",
    "app/tennis-note-member-app/data/push.js",
    "app/tennis-note-member-app/domain/common.js",
    "app/tennis-note-member-app/domain/identity.js",
    "app/tennis-note-member-app/domain/journal.js",
    "app/tennis-note-member-app/domain/members.js",
    "app/tennis-note-member-app/domain/purchase.js",
    "app/tennis-note-member-app/domain/schedule.js",
    "app/tennis-note-member-app/domain/tickets.js",
    "app/tennis-note-member-app/forms/common.js",
    "app/tennis-note-member-app/forms/members.js",
    "app/tennis-note-member-app/forms/schedule.js",
    "app/tennis-note-member-app/index.html",
    "app/tennis-note-member-app/storage.js",
    "app/tennis-note-member-app/views/products.js",
}

DEV_WORKFLOW = ".github/workflows/deploy-cloudflare-pages-dev.yml"
DEV_CHECKOUT_HISTORY_AUTHORITY_PATH = "tests/fixtures/development-checkout-history-source-parity.json"
DEV_CHECKOUT_HISTORY_BEFORE_SHA256 = "26d40bdb3e4961a79cdd83e71df40d34e8097d2d0beb77f81cc49e8268881712"
DEV_WORKFLOW_LINES = (
    '      TENNISNOTE_DEVELOPMENT_EMAIL_SIGNIN_ENABLED: "true"',
    '          grep -q \'"developmentEmailSignIn": true\' dist/member-dev/shared/config.local.js',
    '          grep -q \'"emailPasswordAuthUi": false\' dist/member-dev/shared/config.local.js',
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


_GIT_READ_CACHE_MAX_ENTRIES = 512
_GIT_READ_CACHE_MAX_BYTES = 16 * 1024 * 1024
_GIT_READ_CACHE_MAX_ITEM_BYTES = 2 * 1024 * 1024
_GIT_READ_CACHE: OrderedDict[tuple[str, tuple[str, ...], bool], str | bytes] = OrderedDict()
_GIT_READ_CACHE_BYTES = 0


def _immutable_git_read_key(args: tuple[str, ...], text: bool) -> tuple[str, tuple[str, ...], bool] | None:
    """Cache only reads pinned to full object IDs; refs, HEAD, and worktree state stay live."""
    full_sha = re.compile(r"[0-9a-fA-F]{40}")
    root = str(ROOT.resolve())
    if len(args) == 2 and args[0] == "show":
        revision, separator, path = args[1].partition(":")
        if separator and path and full_sha.fullmatch(revision):
            return (root, args, text)
    if len(args) == 5 and args[:4] == ("rev-list", "--parents", "-n", "1") and full_sha.fullmatch(args[4]):
        return (root, args, text)
    if len(args) == 5 and args[:4] == ("diff-tree", "--no-commit-id", "--name-only", "-r") and full_sha.fullmatch(args[4]):
        return (root, args, text)
    if len(args) == 4 and args[:2] == ("diff", "--name-only") and all(full_sha.fullmatch(value) for value in args[2:]):
        return (root, args, text)
    if len(args) == 5 and args[:3] == ("ls-tree", "-r", "--name-only") and full_sha.fullmatch(args[3]):
        return (root, args, text)
    if (len(args) == 4 and args[:3] == ("log", "--reverse", "--format=%H%x1f%s")
            and re.fullmatch(r"[0-9a-fA-F]{40}\.\.[0-9a-fA-F]{40}", args[3])):
        return (root, args, text)
    return None


def _git_output_size(output: str | bytes) -> int:
    return len(output.encode("utf-8")) if isinstance(output, str) else len(output)


def _cache_git_output(key: tuple[str, tuple[str, ...], bool], output: str | bytes) -> None:
    global _GIT_READ_CACHE_BYTES
    size = _git_output_size(output)
    if size > _GIT_READ_CACHE_MAX_ITEM_BYTES or size > _GIT_READ_CACHE_MAX_BYTES:
        return
    previous = _GIT_READ_CACHE.pop(key, None)
    if previous is not None:
        _GIT_READ_CACHE_BYTES -= _git_output_size(previous)
    while _GIT_READ_CACHE and (
        len(_GIT_READ_CACHE) >= _GIT_READ_CACHE_MAX_ENTRIES
        or _GIT_READ_CACHE_BYTES + size > _GIT_READ_CACHE_MAX_BYTES
    ):
        _, evicted = _GIT_READ_CACHE.popitem(last=False)
        _GIT_READ_CACHE_BYTES -= _git_output_size(evicted)
    _GIT_READ_CACHE[key] = output
    _GIT_READ_CACHE_BYTES += size


def run_git(*args: str, text: bool = True) -> str | bytes:
    cache_key = _immutable_git_read_key(args, text)
    if cache_key is not None and cache_key in _GIT_READ_CACHE:
        _GIT_READ_CACHE.move_to_end(cache_key)
        return _GIT_READ_CACHE[cache_key]
    result = subprocess.run(
        ["git", *args],
        cwd=ROOT,
        check=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=text,
        encoding="utf-8" if text else None,
    )
    output = result.stdout
    if cache_key is not None:
        _cache_git_output(cache_key, output)
    return output


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def authority_bytes(path: str) -> bytes:
    return run_git("show", f"{AUTHORITY_SHA}:{path}", text=False)


def authority_paths(prefix: str) -> list[str]:
    output = run_git("ls-tree", "-r", "--name-only", AUTHORITY_SHA, prefix)
    return sorted(line for line in str(output).splitlines() if line)


def release_metadata(path: Path) -> dict[str, str]:
    data = json.loads(restore_auth_dev_prepare_base(path.relative_to(ROOT).as_posix(), path.read_text(encoding="utf-8")))
    return {
        "version": str(data["version"]),
        "release_id": str(data["releaseId"]),
        "deployed_at": str(data["deployedAt"]),
    }


def restore_renewal_hold_base(path: str, text: str) -> str:
    """승인된 exact hunk만 역변환하며 기존 제품 golden은 바꾸지 않는다."""
    port = json.loads((ROOT / "tests/fixtures/renewal-hold-source-parity.json").read_text(encoding="utf-8"))
    row = next((item for item in port["files"] if item["path"] == path), None)
    if not row or hashlib.sha256(text.encode()).hexdigest() != row["candidateSha256"]:
        return text  # 다른 소스는 기존 golden 검사가 그대로 거부한다.
    for hunk in row["hunks"]:
        if text.count(hunk["after"]) != 1:
            raise ValueError(f"renewal hold ambiguous hunk: {path}")
        text = text.replace(hunk["after"], hunk["before"], 1)
    if hashlib.sha256(text.encode()).hexdigest() != row["baseSha256"]:
        raise ValueError(f"renewal hold base drift: {path}")
    # exact 역변환 hash 검증 뒤 버전 literal만 현재 release로 되돌린다.
    return text.replace(port["baseVersion"], port["releaseVersion"])


def restore_member_home_base(path: str, text: str, port: dict) -> str:
    """승인된 홈 블록만 exact hash로 역변환. 기존 HOLD/코치/golden은 그대로 둔다."""
    row = next((item for item in port["files"] if item["path"] == path), None)
    if row is None:
        return text
    if sha256(text.encode("utf-8")) != row["candidateSha256"]:
        raise RuntimeError(f"member home candidate drift: {path}")
    for hunk in reversed(row["hunks"]):
        if text.count(hunk["after"]) != 1:
            raise RuntimeError(f"member home authority drift: {path}")
        text = text.replace(hunk["after"], hunk["before"], 1)
    if sha256(text.encode("utf-8")) != row["baseSha256"]:
        raise RuntimeError(f"member home base drift: {path}")
    return text


def restore_coach_round_base(path: str, text: str) -> str:
    """승인된 회차 블록만 역변환하며 기존 golden hash는 유지한다."""
    port = json.loads((ROOT / "tests/fixtures/coach-round-source-parity.json").read_text(encoding="utf-8"))
    row = next((item for item in port["files"] if item["path"] == path), None)
    if row is None:
        return text
    if sha256(text.encode("utf-8")) != row["candidateSha256"]:
        raise RuntimeError(f"coach round candidate drift: {path}")
    for hunk in row["hunks"]:
        if text.count(hunk["after"]) != 1 or sha256(hunk["after"].encode("utf-8")) != row["authorityBlockSha256"]:
            raise RuntimeError(f"coach round authority drift: {path}")
        text = text.replace(hunk["after"], hunk["before"], 1)
    if sha256(text.encode("utf-8")) != row["baseSha256"]:
        raise RuntimeError(f"coach round base drift: {path}")
    return text


def restore_exact_outer_base(path: str, text: str, fixture: str, input_version: str) -> str:
    """최신 증분을 단 한 번 exact 역변환하고 기존 내부 golden은 보존한다."""
    port = json.loads((ROOT / "tests/fixtures" / fixture).read_text(encoding="utf-8"))
    row = next((item for item in port["files"] if item["path"] == path), None)
    if row is None:
        return text
    text = text.replace(input_version, port["publicVersion"])
    if sha256(text.encode("utf-8")) != row["candidateSha256"]:
        raise RuntimeError(f"{fixture} candidate hash drift: {path}")
    for hunk in reversed(row["hunks"]):
        if not hunk["after"] or text.count(hunk["after"]) != 1:
            raise RuntimeError(f"{fixture} inverse hunk drift: {path}")
        text = text.replace(hunk["after"], hunk["before"], 1)
    if sha256(text.encode("utf-8")) != row["baseSha256"]:
        raise RuntimeError(f"{fixture} baseline hash drift: {path}")
    return text.replace(port["publicVersion"], input_version)


def restore_auth_session_loss_base(path: str, text: str) -> str:
    port = json.loads((ROOT / "tests/fixtures/verified-profile-phone-source-parity.json").read_text(encoding="utf-8"))
    contract = port.get("sessionLoss")
    if not contract or contract.get("contract") != "auth-session-loss-fail-closed/1":
        raise RuntimeError("Auth session loss contract missing")
    row = next((item for item in contract["files"] if item["path"] == path), None)
    if row is None:
        return text
    if sha256(text.encode("utf-8")) != row["afterFileSha256"]:
        raise RuntimeError(f"Auth session loss candidate drift: {path}")
    for function in reversed(row["functions"]):
        before, after = function["before"], function["after"]
        if sha256(before.encode("utf-8")) != function["beforeSha256"] or sha256(after.encode("utf-8")) != function["afterSha256"]:
            raise RuntimeError(f"Auth session loss function pin drift: {path}")
        if not after or text.count(after) != 1:
            raise RuntimeError(f"Auth session loss inverse drift: {path}")
        text = text.replace(after, before, 1)
    if sha256(text.encode("utf-8")) != row["beforeFileSha256"]:
        raise RuntimeError(f"Auth session loss baseline drift: {path}")
    return text


def restore_auth_reconciliation_base(path: str, text: str) -> str:
    text = restore_auth_session_loss_base(path, text)
    """새 Auth 증분만 검증·역변환하며 기존 운영 golden은 보존한다."""
    port = json.loads((ROOT / "tests/fixtures/verified-profile-phone-source-parity.json").read_text(encoding="utf-8"))
    contract = port.get("authReconciliation")
    if not contract or contract.get("contract") != "auth-direct-phone-reconciliation/1":
        raise RuntimeError("Auth reconciliation contract missing")
    row = next((item for item in contract["files"] if item["path"] == path), None)
    if row is None:
        return text
    if sha256(text.encode("utf-8")) != row["afterFileSha256"]:
        raise RuntimeError(f"Auth candidate drift: {path}")
    for function in reversed(row["functions"]):
        before, after = function["before"], function["after"]
        if sha256(before.encode("utf-8")) != function["beforeSha256"] or sha256(after.encode("utf-8")) != function["afterSha256"]:
            raise RuntimeError(f"Auth function pin drift: {path}")
        needle = after if before else "\n\n" + after + "\n"
        replacement = before or "\n"
        if not needle or text.count(needle) != 1:
            raise RuntimeError(f"Auth inverse drift: {path}")
        text = text.replace(needle, replacement, 1)
    if sha256(text.encode("utf-8")) != row["beforeFileSha256"]:
        raise RuntimeError(f"Auth baseline drift: {path}")
    return text


def restore_verified_profile_phone_base(path: str, text: str) -> str:
    text = restore_auth_reconciliation_base(path, text)
    port = json.loads((ROOT / "tests/fixtures/verified-profile-phone-source-parity.json").read_text(encoding="utf-8"))
    text = restore_exact_outer_base(path, text, "profile-editor-draft-source-parity.json", port["publicVersion"])
    text = restore_exact_outer_base(path, text, "profile-durable-readback-source-parity.json", port["publicVersion"])
    text = restore_exact_outer_base(path, text, "profile-operation-status-source-parity.json", port["publicVersion"])
    row = next((item for item in port["files"] if item["path"] == path), None)
    if row is None:
        return text
    if sha256(text.encode("utf-8")) != row["candidateSha256"]:
        raise RuntimeError(f"verified profile phone candidate drift: {path}")
    for hunk in reversed(row["hunks"]):
        if text.count(hunk["after"]) != 1:
            raise RuntimeError(f"verified profile phone authority drift: {path}")
        text = text.replace(hunk["after"], hunk["before"], 1)
    if sha256(text.encode("utf-8")) != row["baseSha256"]:
        raise RuntimeError(f"verified profile phone base drift: {path}")
    return text


def restore_development_signin_base(path: str, text: str) -> str:
    port = json.loads((ROOT / "tests/fixtures/development-signin-source-parity.json").read_text(encoding="utf-8"))
    row = next((item for item in port["files"] if item["path"] == path), None)
    if row is None:
        return text
    if sha256(text.encode("utf-8")) != row["candidateSha256"]:
        raise RuntimeError(f"development signin candidate drift: {path}")
    for hunk in reversed(row["hunks"]):
        if text.count(hunk["after"]) != 1:
            raise RuntimeError(f"development signin authority drift: {path}")
        text = text.replace(hunk["after"], hunk["before"], 1)
    if sha256(text.encode("utf-8")) != row["baseSha256"]:
        raise RuntimeError(f"development signin base drift: {path}")
    return text


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
    text = restore_auth_dev_prepare_base(path.relative_to(ROOT).as_posix(), path.read_text(encoding="utf-8"))
    match = re.search(r'^const CACHE_NAME = "([^"]+)";', text, re.M)
    if not match:
        raise RuntimeError(f"CACHE_NAME not found: {path}")
    return match.group(1)


def _load_r3_successor_authority(authority: dict[str, object] | None = None) -> dict[str, object]:
    port = authority if authority is not None else json.loads(R3_SUCCESSOR_AUTHORITY_PATH.read_text(encoding="utf-8"))
    if (port.get("contract") != "r3-basic-settlement-successor-authority-v1"
            or port.get("baseCommit") != R3_SUCCESSOR_BASE_SHA
            or port.get("candidateCommit") != R3_SUCCESSOR_CANDIDATE_SHA
            or port.get("target") != R3_SUCCESSOR_TARGET
            or port.get("targetBranch") != R3_SUCCESSOR_BRANCH
            or port.get("baseVersion") != "1.0.548"
            or port.get("candidateVersion") != "1.0.549"
            or port.get("baseReleaseId") != "2026.10.13.02"
            or port.get("candidateReleaseId") != "2026.10.19.01"):
        raise RuntimeError("R3 successor authority context mismatch")
    files = port.get("files")
    if not isinstance(files, list):
        raise RuntimeError("R3 successor authority file list invalid")
    paths = [row.get("path") for row in files if isinstance(row, dict)]
    if len(paths) != len(files) or len(paths) != len(set(paths)) or set(paths) != R3_SUCCESSOR_EXPECTED_PATHS:
        raise RuntimeError("R3 successor authority exact path set mismatch")
    for row in files:
        if not re.fullmatch(r"[a-f0-9]{64}", str(row.get("beforeSha256", ""))) or not re.fullmatch(r"[a-f0-9]{64}", str(row.get("afterSha256", ""))):
            raise RuntimeError("R3 successor authority hash invalid")
        replacements = row.get("replacements", [])
        hunks = row.get("hunks", [])
        if not isinstance(replacements, list) or not isinstance(hunks, list) or bool(replacements) == bool(hunks):
            raise RuntimeError("R3 successor authority inverse contract invalid")
    return port


def _validate_r3_policy_550_content_authority(port: dict[str, object]) -> dict[str, object]:
    if (port.get("contract") != "r3-coach-schedule-policy-successor-authority-v1"
            or port.get("baseCommit") != R3_POLICY_550_BASE_SHA
            or port.get("baseVersion") != "1.0.549"
            or port.get("candidateVersion") != "1.0.550"
            or port.get("baseReleaseId") != "2026.10.19.01"
            or port.get("candidateReleaseId") != "2026.10.20.01"
            or port.get("target") != R3_SUCCESSOR_TARGET
            or port.get("targetBranch") != R3_SUCCESSOR_BRANCH):
        raise RuntimeError("R3 550 successor content authority context mismatch")
    stack = port.get("commitStack")
    feature_paths = stack.get("featurePaths") if isinstance(stack, dict) else None
    release_paths = stack.get("releasePaths") if isinstance(stack, dict) else None
    if (not isinstance(feature_paths, list) or not isinstance(release_paths, list)
            or any(not isinstance(path, str) for path in [*(feature_paths or []), *(release_paths or [])])
            or len(feature_paths) != len(set(feature_paths)) or len(release_paths) != len(set(release_paths))
            or set(feature_paths) != R3_POLICY_550_FEATURE_PATHS
            or set(release_paths) != R3_POLICY_550_RELEASE_PATHS):
        raise RuntimeError("R3 550 documented two-commit path contract mismatch")
    files = port.get("files")
    if not isinstance(files, list):
        raise RuntimeError("R3 550 successor content file list invalid")
    paths = [row.get("path") for row in files if isinstance(row, dict)]
    if len(paths) != len(files) or len(paths) != len(set(paths)) or set(paths) != R3_POLICY_550_EXPECTED_PATHS:
        raise RuntimeError("R3 550 successor exact path set mismatch")
    for row in files:
        if not re.fullmatch(r"[a-f0-9]{64}", str(row.get("beforeSha256", ""))) or not re.fullmatch(r"[a-f0-9]{64}", str(row.get("afterSha256", ""))):
            raise RuntimeError("R3 550 successor content hash invalid")
        replacements = row.get("replacements", [])
        hunks = row.get("hunks", [])
        if not isinstance(replacements, list) or not isinstance(hunks, list) or bool(replacements) == bool(hunks):
            raise RuntimeError("R3 550 successor inverse contract invalid")
    return port


def _load_r3_policy_550_authority(authority: dict[str, object] | None = None) -> dict[str, object]:
    port = _validate_r3_policy_550_content_authority(
        authority if authority is not None else json.loads(R3_POLICY_550_AUTHORITY_PATH.read_text(encoding="utf-8"))
    )
    candidate = port.get("candidateCommit")
    if port.get("bindingStatus") != "BOUND_TO_EXACT_TWO_COMMIT_STACK" or not re.fullmatch(r"[a-f0-9]{40}", str(candidate or "")):
        raise RuntimeError("R3 550 candidate commit binding pending")
    # Project policy requires one product commit followed by a separate release commit.
    # candidateCommit binds the latter; its first parent is derived, never guessed.
    base_tree = str(port["baseCommit"])
    candidate = str(candidate)
    if not re.fullmatch(r"[a-f0-9]{40}", base_tree):
        raise RuntimeError("R3 550 base commit invalid")

    def single_parent(revision: str, expected_parent: str | None = None) -> str:
        ancestry = str(run_git("rev-list", "--parents", "-n", "1", revision)).split()
        if len(ancestry) != 2 or ancestry[0] != revision:
            raise RuntimeError("R3 550 stack contains a merge or root commit")
        parent = ancestry[1]
        if expected_parent is not None and parent != expected_parent:
            raise RuntimeError("R3 550 commit stack parent mismatch")
        return parent

    feature = single_parent(candidate)
    single_parent(feature, base_tree)

    def changed_paths(*args: str) -> set[str]:
        return set(str(run_git(*args)).splitlines())

    if changed_paths("diff-tree", "--no-commit-id", "--name-only", "-r", feature) != R3_POLICY_550_FEATURE_PATHS:
        raise RuntimeError("R3 550 feature commit path set mismatch")
    if changed_paths("diff-tree", "--no-commit-id", "--name-only", "-r", candidate) != R3_POLICY_550_RELEASE_PATHS:
        raise RuntimeError("R3 550 release commit path set mismatch")
    if changed_paths("diff", "--name-only", base_tree, candidate) != R3_POLICY_550_EXPECTED_PATHS:
        raise RuntimeError("R3 550 cumulative candidate path set mismatch")
    for row in port["files"]:
        path = str(row["path"])
        base = run_git("show", f"{base_tree}:{path}", text=False)
        feature_blob = run_git("show", f"{feature}:{path}", text=False)
        after = run_git("show", f"{candidate}:{path}", text=False)
        if sha256(base.replace(b"\r\n", b"\n")) != row["beforeSha256"]:
            raise RuntimeError(f"R3 550 base commit content drift: {path}")
        if sha256(after.replace(b"\r\n", b"\n")) != row["afterSha256"]:
            raise RuntimeError(f"R3 550 candidate commit content drift: {path}")
        expected_feature_hash = row["afterSha256"] if path in R3_POLICY_550_FEATURE_PATHS else row["beforeSha256"]
        if sha256(feature_blob.replace(b"\r\n", b"\n")) != expected_feature_hash:
            raise RuntimeError(f"R3 550 feature commit content drift: {path}")
    return port


def _restore_r3_policy_550_content(path: str, text: str, port: dict[str, object]) -> str:
    """Content-only inverse used by offline tests; live callers require commit binding."""
    _validate_r3_policy_550_content_authority(port)
    normalized_path = Path(path).as_posix()
    row = next((item for item in port["files"] if item["path"] == normalized_path), None)
    if row is None:
        return text
    candidate_text = text.replace("\r\n", "\n")
    if sha256(candidate_text.encode("utf-8")) != row["afterSha256"]:
        raise RuntimeError(f"R3 550 successor candidate content drift: {normalized_path}")
    for rule in row.get("replacements", []):
        candidate, base, count = rule.get("candidate"), rule.get("base"), rule.get("count")
        if not isinstance(candidate, str) or not candidate or not isinstance(base, str) or not isinstance(count, int) or count < 1:
            raise RuntimeError(f"R3 550 replacement authority invalid: {normalized_path}")
        if candidate_text.count(candidate) != count:
            raise RuntimeError(f"R3 550 replacement count drift: {normalized_path}")
        candidate_text = candidate_text.replace(candidate, base)
    for hunk in row.get("hunks", []):
        after, before = hunk.get("candidate"), hunk.get("base")
        if not isinstance(after, str) or not after or not isinstance(before, str) or hunk.get("count") != 1:
            raise RuntimeError(f"R3 550 hunk authority invalid: {normalized_path}")
        if candidate_text.count(after) != 1:
            raise RuntimeError(f"R3 550 exact hunk count drift: {normalized_path}")
        candidate_text = candidate_text.replace(after, before)
    if sha256(candidate_text.encode("utf-8")) != row["beforeSha256"]:
        raise RuntimeError(f"R3 550 restored baseline content drift: {normalized_path}")
    return candidate_text


def restore_r3_coach_schedule_policy_successor_base(path: str, text: str) -> str:
    """Strict 1.0.550 successor inverse; requires a bound exact commit stack."""
    return _restore_r3_policy_550_content(path, text, _load_r3_policy_550_authority())


def _validate_r3_policy_551_content_authority(port: dict[str, object]) -> dict[str, object]:
    stack = port.get("commitStack")
    feature_paths = stack.get("featurePaths") if isinstance(stack, dict) else None
    release_paths = stack.get("releasePaths") if isinstance(stack, dict) else None
    if (port.get("contract") != "r3-coach-settlement-input-successor-authority-v1"
            or port.get("baseCommit") != R3_POLICY_551_BASE_SHA
            or port.get("candidateVersion") != "1.0.551"
            or port.get("baseVersion") != "1.0.550"
            or port.get("candidateReleaseId") != "2026.10.20.02"
            or port.get("baseReleaseId") != "2026.10.20.01"
            or port.get("target") != "public-dev" or port.get("targetBranch") != "dev"
            or not isinstance(feature_paths, list) or set(feature_paths) != R3_POLICY_551_FEATURE_PATHS
            or not isinstance(release_paths, list) or set(release_paths) != R3_POLICY_551_RELEASE_PATHS):
        raise RuntimeError("R3 551 successor authority context mismatch")
    if (len(feature_paths) != len(set(feature_paths)) or len(release_paths) != len(set(release_paths))
            or port.get("bindingStatus") not in {"PENDING_EXACT_TWO_COMMIT_STACK", "BOUND_TO_EXACT_TWO_COMMIT_STACK"}):
        raise RuntimeError("R3 551 successor authority stack contract invalid")
    files = port.get("files")
    if not isinstance(files, list):
        raise RuntimeError("R3 551 successor authority file list invalid")
    paths = [row.get("path") for row in files if isinstance(row, dict)]
    if len(paths) != len(files) or len(paths) != len(set(paths)) or set(paths) != R3_POLICY_551_EXPECTED_PATHS:
        raise RuntimeError("R3 551 successor authority exact path set mismatch")
    for row in files:
        for name in ("beforeSha256", "afterSha256"):
            if not re.fullmatch(r"[a-f0-9]{64}", str(row.get(name, ""))):
                raise RuntimeError("R3 551 successor authority hash invalid")
        if row["path"] in R3_POLICY_551_FEATURE_PATHS:
            if not re.fullmatch(r"[a-f0-9]{64}", str(row.get("featureSha256", ""))):
                raise RuntimeError("R3 551 feature-stage hash invalid")
        elif "featureSha256" in row:
            raise RuntimeError("R3 551 unexpected feature-stage hash")
        replacements, hunks = row.get("replacements", []), row.get("hunks", [])
        if (not isinstance(replacements, list) or not isinstance(hunks, list)
                or bool(replacements) == bool(hunks)):
            raise RuntimeError("R3 551 inverse contract invalid")
    return port


def _load_r3_policy_551_authority(authority: dict[str, object] | None = None) -> dict[str, object]:
    port = _validate_r3_policy_551_content_authority(
        authority if authority is not None else json.loads(R3_POLICY_551_AUTHORITY_PATH.read_text(encoding="utf-8"))
    )
    candidate = port.get("candidateCommit")
    if (port.get("bindingStatus") != "BOUND_TO_EXACT_TWO_COMMIT_STACK"
            or not re.fullmatch(r"[a-f0-9]{40}", str(candidate or ""))):
        raise RuntimeError("R3 551 candidate commit binding pending")
    base = str(port["baseCommit"])

    def parent(revision: str, expected: str | None = None) -> str:
        row = str(run_git("rev-list", "--parents", "-n", "1", revision)).split()
        if len(row) != 2 or row[0] != revision:
            raise RuntimeError("R3 551 stack contains a merge or root commit")
        if expected is not None and row[1] != expected:
            raise RuntimeError("R3 551 commit parent mismatch")
        return row[1]

    feature = parent(str(candidate))
    parent(feature, base)

    def paths(*args: str) -> set[str]:
        return set(str(run_git(*args)).splitlines())

    if paths("diff-tree", "--no-commit-id", "--name-only", "-r", feature) != R3_POLICY_551_FEATURE_PATHS:
        raise RuntimeError("R3 551 feature commit path set mismatch")
    if paths("diff-tree", "--no-commit-id", "--name-only", "-r", str(candidate)) != R3_POLICY_551_RELEASE_PATHS:
        raise RuntimeError("R3 551 release commit path set mismatch")
    if paths("diff", "--name-only", base, str(candidate)) != R3_POLICY_551_EXPECTED_PATHS:
        raise RuntimeError("R3 551 cumulative candidate path set mismatch")
    for row in port["files"]:
        path = str(row["path"])
        base_blob = run_git("show", f"{base}:{path}", text=False).replace(b"\r\n", b"\n")
        feature_blob = run_git("show", f"{feature}:{path}", text=False).replace(b"\r\n", b"\n")
        candidate_blob = run_git("show", f"{candidate}:{path}", text=False).replace(b"\r\n", b"\n")
        digest = lambda content: sha256(content)
        if digest(base_blob) != row["beforeSha256"]:
            raise RuntimeError(f"R3 551 base content drift: {path}")
        expected_feature = row.get("featureSha256", row["beforeSha256"])
        if digest(feature_blob) != expected_feature:
            raise RuntimeError(f"R3 551 feature content drift: {path}")
        expected_candidate = row["afterSha256"] if path in R3_POLICY_551_RELEASE_PATHS else expected_feature
        if digest(candidate_blob) != expected_candidate or digest(candidate_blob) != row["afterSha256"]:
            raise RuntimeError(f"R3 551 release content drift: {path}")
    return port


def _restore_r3_policy_551_content(path: str, text: str, port: dict[str, object]) -> str:
    _validate_r3_policy_551_content_authority(port)
    normalized = Path(path).as_posix()
    row = next((item for item in port["files"] if item["path"] == normalized), None)
    if row is None:
        return text
    candidate_text = text.replace("\r\n", "\n")
    if sha256(candidate_text.encode("utf-8")) != row["afterSha256"]:
        raise RuntimeError(f"R3 551 successor candidate content drift: {normalized}")
    for rule in row.get("replacements", []):
        after, before, count = rule.get("candidate"), rule.get("base"), rule.get("count")
        if not isinstance(after, str) or not after or not isinstance(before, str) or not isinstance(count, int) or count < 1:
            raise RuntimeError(f"R3 551 replacement authority invalid: {normalized}")
        if candidate_text.count(after) != count:
            raise RuntimeError(f"R3 551 replacement drift: {normalized}")
        candidate_text = candidate_text.replace(after, before)
    for hunk in row.get("hunks", []):
        after, before = hunk.get("candidate"), hunk.get("base")
        if not isinstance(after, str) or not after or not isinstance(before, str) or hunk.get("count") != 1:
            raise RuntimeError(f"R3 551 inverse hunk invalid: {normalized}")
        if candidate_text.count(after) != 1:
            raise RuntimeError(f"R3 551 inverse hunk drift: {normalized}")
        candidate_text = candidate_text.replace(after, before)
    if sha256(candidate_text.encode("utf-8")) != row["beforeSha256"]:
        raise RuntimeError(f"R3 551 restored baseline drift: {normalized}")
    return candidate_text


def restore_r3_hourly_input_successor_base(path: str, text: str) -> str:
    """Strict 1.0.551 successor inverse; requires an exact feature/release binding."""
    return _restore_r3_policy_551_content(path, text, _load_r3_policy_551_authority())


def _validate_r3_policy_552_content_authority(port: dict[str, object]) -> dict[str, object]:
    stack = port.get("commitStack")
    feature_paths = stack.get("featurePaths") if isinstance(stack, dict) else None
    release_paths = stack.get("releasePaths") if isinstance(stack, dict) else None
    if (port.get("contract") != "r3-coach-settlement-input-successor-authority-v2"
            or port.get("baseCommit") != R3_POLICY_552_BASE_SHA
            or port.get("candidateVersion") != "1.0.552"
            or port.get("baseVersion") != "1.0.551"
            or port.get("candidateReleaseId") != "2026.10.20.03"
            or port.get("baseReleaseId") != "2026.10.20.02"
            or port.get("target") != "public-dev" or port.get("targetBranch") != "dev"
            or not isinstance(feature_paths, list) or set(feature_paths) != R3_POLICY_552_FEATURE_PATHS
            or not isinstance(release_paths, list) or set(release_paths) != R3_POLICY_552_RELEASE_PATHS):
        raise RuntimeError("R3 552 successor authority context mismatch")
    if (len(feature_paths) != len(set(feature_paths)) or len(release_paths) != len(set(release_paths))
            or port.get("bindingStatus") not in {"PENDING_EXACT_TWO_COMMIT_STACK", "BOUND_TO_EXACT_TWO_COMMIT_STACK"}):
        raise RuntimeError("R3 552 successor authority stack contract invalid")
    if (not isinstance(stack, dict)
            or stack.get("featureTestPath") != "tests/coach-staff-settlement-readback.test.js"
            or not re.fullmatch(r"[a-f0-9]{64}", str(stack.get("featureTestSha256", "")))):
        raise RuntimeError("R3 552 feature test blob authority invalid")
    files = port.get("files")
    if not isinstance(files, list):
        raise RuntimeError("R3 552 successor authority file list invalid")
    paths = [row.get("path") for row in files if isinstance(row, dict)]
    if len(paths) != len(files) or len(paths) != len(set(paths)) or set(paths) != R3_POLICY_552_CONTENT_PATHS:
        raise RuntimeError("R3 552 successor authority exact content path set mismatch")
    for row in files:
        for name in ("beforeSha256", "afterSha256"):
            if not re.fullmatch(r"[a-f0-9]{64}", str(row.get(name, ""))):
                raise RuntimeError("R3 552 successor authority hash invalid")
        if row["path"] == "app/admin/views/settings.js":
            if not re.fullmatch(r"[a-f0-9]{64}", str(row.get("featureSha256", ""))):
                raise RuntimeError("R3 552 feature-stage hash invalid")
        elif "featureSha256" in row:
            raise RuntimeError("R3 552 unexpected feature-stage hash")
        replacements, hunks = row.get("replacements", []), row.get("hunks", [])
        if (not isinstance(replacements, list) or not isinstance(hunks, list)
                or bool(replacements) == bool(hunks)):
            raise RuntimeError("R3 552 inverse contract invalid")
    return port


def _load_r3_policy_552_authority(authority: dict[str, object] | None = None) -> dict[str, object]:
    port = _validate_r3_policy_552_content_authority(
        authority if authority is not None else json.loads(R3_POLICY_552_AUTHORITY_PATH.read_text(encoding="utf-8"))
    )
    candidate = port.get("candidateCommit")
    if (port.get("bindingStatus") != "BOUND_TO_EXACT_TWO_COMMIT_STACK"
            or not re.fullmatch(r"[a-f0-9]{40}", str(candidate or ""))):
        raise RuntimeError("R3 552 candidate commit binding pending")
    base = str(port["baseCommit"])

    def parent(revision: str, expected: str | None = None) -> str:
        row = str(run_git("rev-list", "--parents", "-n", "1", revision)).split()
        if len(row) != 2 or row[0] != revision:
            raise RuntimeError("R3 552 stack contains a merge or root commit")
        if expected is not None and row[1] != expected:
            raise RuntimeError("R3 552 commit parent mismatch")
        return row[1]

    feature = parent(str(candidate))
    parent(feature, base)

    def paths(*args: str) -> set[str]:
        return set(str(run_git(*args)).splitlines())

    if paths("diff-tree", "--no-commit-id", "--name-only", "-r", feature) != R3_POLICY_552_FEATURE_PATHS:
        raise RuntimeError("R3 552 feature commit path set mismatch")
    if paths("diff-tree", "--no-commit-id", "--name-only", "-r", str(candidate)) != R3_POLICY_552_RELEASE_PATHS:
        raise RuntimeError("R3 552 release commit path set mismatch")
    if paths("diff", "--name-only", base, str(candidate)) != R3_POLICY_552_EXPECTED_PATHS:
        raise RuntimeError("R3 552 cumulative candidate path set mismatch")
    test_path = str(port["commitStack"]["featureTestPath"])
    test_blob = run_git("show", f"{feature}:{test_path}", text=False).replace(b"\r\n", b"\n")
    if sha256(test_blob) != port["commitStack"]["featureTestSha256"]:
        raise RuntimeError("R3 552 feature test blob drift")
    for row in port["files"]:
        path = str(row["path"])
        base_blob = run_git("show", f"{base}:{path}", text=False).replace(b"\r\n", b"\n")
        feature_blob = run_git("show", f"{feature}:{path}", text=False).replace(b"\r\n", b"\n")
        candidate_blob = run_git("show", f"{candidate}:{path}", text=False).replace(b"\r\n", b"\n")
        digest = lambda content: sha256(content)
        if digest(base_blob) != row["beforeSha256"]:
            raise RuntimeError(f"R3 552 base content drift: {path}")
        expected_feature = row.get("featureSha256", row["beforeSha256"])
        if digest(feature_blob) != expected_feature:
            raise RuntimeError(f"R3 552 feature content drift: {path}")
        if digest(candidate_blob) != row["afterSha256"]:
            raise RuntimeError(f"R3 552 release content drift: {path}")
    return port


def _restore_r3_policy_552_content(path: str, text: str, port: dict[str, object]) -> str:
    _validate_r3_policy_552_content_authority(port)
    normalized = Path(path).as_posix()
    row = next((item for item in port["files"] if item["path"] == normalized), None)
    if row is None:
        return text
    candidate_text = text.replace("\r\n", "\n")
    if sha256(candidate_text.encode("utf-8")) != row["afterSha256"]:
        raise RuntimeError(f"R3 552 successor candidate content drift: {normalized}")
    for rule in row.get("replacements", []):
        after, before, count = rule.get("candidate"), rule.get("base"), rule.get("count")
        if not isinstance(after, str) or not after or not isinstance(before, str) or not isinstance(count, int) or count < 1:
            raise RuntimeError(f"R3 552 replacement authority invalid: {normalized}")
        if candidate_text.count(after) != count:
            raise RuntimeError(f"R3 552 replacement drift: {normalized}")
        candidate_text = candidate_text.replace(after, before)
    for hunk in row.get("hunks", []):
        after, before = hunk.get("candidate"), hunk.get("base")
        if not isinstance(after, str) or not after or not isinstance(before, str) or hunk.get("count") != 1:
            raise RuntimeError(f"R3 552 inverse hunk invalid: {normalized}")
        if candidate_text.count(after) != 1:
            raise RuntimeError(f"R3 552 inverse hunk drift: {normalized}")
        candidate_text = candidate_text.replace(after, before)
    if sha256(candidate_text.encode("utf-8")) != row["beforeSha256"]:
        raise RuntimeError(f"R3 552 restored baseline drift: {normalized}")
    return candidate_text


def restore_r3_coach_settlement_input_successor_base(path: str, text: str) -> str:
    """Strict 1.0.552 successor inverse; requires the exact feature/release commit stack."""
    return _restore_r3_policy_552_content(path, text, _load_r3_policy_552_authority())


def _load_r3_manual_payout_release_authority() -> dict[str, object]:
    """Validate the exact two-commit public payout candidate before historical inverses."""
    source = json.loads(R3_MANUAL_PAYOUT_SOURCE_AUTHORITY_PATH.read_text(encoding="utf-8"))
    port = source.get("releaseSuccessor") if isinstance(source, dict) else None
    if not isinstance(port, dict):
        raise RuntimeError("R3 manual payout release successor authority missing")
    if (port.get("contract") != "r3-manual-payout-public-dev-release-successor/1"
            or port.get("baseCommit") != R3_MANUAL_PAYOUT_BASE_SHA
            or port.get("featureCommit") != R3_MANUAL_PAYOUT_FEATURE_SHA
            or port.get("candidateCommit") != R3_MANUAL_PAYOUT_CANDIDATE_SHA
            or port.get("target") != "public-dev" or port.get("targetBranch") != "dev"
            or port.get("baseVersion") != "1.0.552" or port.get("baseReleaseId") != "2026.10.20.03"
            or port.get("targetVersion") != "1.0.554" or port.get("targetReleaseId") != "2026.10.24.02"
            or port.get("memberCacheFloor") != 589 or port.get("coachCacheFloor") != 562
            or port.get("candidateMemberCache") != 590 or port.get("candidateCoachCache") != 563):
        raise RuntimeError("R3 manual payout release successor context mismatch")
    feature_paths = port.get("featurePaths")
    release_paths = port.get("releasePaths")
    if (not isinstance(feature_paths, list) or len(feature_paths) != len(set(feature_paths))
            or set(feature_paths) != R3_MANUAL_PAYOUT_FEATURE_PATHS
            or not isinstance(release_paths, list) or len(release_paths) != len(set(release_paths))
            or set(release_paths) != R3_MANUAL_PAYOUT_RELEASE_PATHS):
        raise RuntimeError("R3 manual payout release successor exact path set mismatch")

    def parent(revision: str, expected: str | None = None) -> str:
        row = str(run_git("rev-list", "--parents", "-n", "1", revision)).split()
        if len(row) != 2 or row[0] != revision:
            raise RuntimeError("R3 manual payout release stack contains a merge or root commit")
        if expected is not None and row[1] != expected:
            raise RuntimeError("R3 manual payout release stack parent mismatch")
        return row[1]

    parent(R3_MANUAL_PAYOUT_FEATURE_SHA, R3_MANUAL_PAYOUT_BASE_SHA)
    parent(R3_MANUAL_PAYOUT_CANDIDATE_SHA, R3_MANUAL_PAYOUT_FEATURE_SHA)

    def paths(*args: str) -> set[str]:
        return set(str(run_git(*args)).splitlines())

    if paths("diff-tree", "--no-commit-id", "--name-only", "-r", R3_MANUAL_PAYOUT_FEATURE_SHA) != R3_MANUAL_PAYOUT_FEATURE_PATHS:
        raise RuntimeError("R3 manual payout feature commit path set mismatch")
    if paths("diff-tree", "--no-commit-id", "--name-only", "-r", R3_MANUAL_PAYOUT_CANDIDATE_SHA) != R3_MANUAL_PAYOUT_RELEASE_PATHS:
        raise RuntimeError("R3 manual payout release commit path set mismatch")
    if paths("diff", "--name-only", R3_MANUAL_PAYOUT_BASE_SHA, R3_MANUAL_PAYOUT_CANDIDATE_SHA) != R3_MANUAL_PAYOUT_EXPECTED_PATHS:
        raise RuntimeError("R3 manual payout candidate cumulative path set mismatch")
    base_release = json.loads(run_git("show", f"{R3_MANUAL_PAYOUT_BASE_SHA}:app/release.json"))
    candidate_release = json.loads(run_git("show", f"{R3_MANUAL_PAYOUT_CANDIDATE_SHA}:app/release.json"))
    if (base_release.get("version") != port["baseVersion"] or base_release.get("releaseId") != port["baseReleaseId"]
            or candidate_release.get("version") != port["targetVersion"]
            or candidate_release.get("releaseId") != port["targetReleaseId"]):
        raise RuntimeError("R3 manual payout release metadata stack mismatch")
    return port


R3_OPEN_REFRESH_AUTHORITY_PATH = ROOT / "tests/fixtures/r3-coach-open-refresh-source-parity.json"
R3_OPEN_REFRESH_BASE_SHA = "99cc0a05d5dc5a9c605184dcd1364936e1d18ffa"
R3_OPEN_REFRESH_FEATURE_SHA = "c5a32aea9b5d0f3270106da9e68f60190da8e6f8"
R3_OPEN_REFRESH_CANDIDATE_SHA = "ca7ec623ecf75e7507302dcb64476694da5903a3"
R3_OPEN_REFRESH_PRODUCTS = frozenset({
    "app/tennis-note-coach-app/ui/screens.js",
    "app/tennis-note-coach-app/events/account.js",
    "app/tennis-note-coach-app/events/delegated.js",
})
R3_OPEN_REFRESH_RELEASE = R3_POLICY_551_RELEASE_PATHS
R3_OPEN_REFRESH_PATHS = R3_OPEN_REFRESH_PRODUCTS | R3_OPEN_REFRESH_RELEASE


def _load_r3_coach_open_refresh_authority(authority: dict | None = None) -> dict:
    """Bind only the reviewed product/official-release stack; old authorities stay frozen."""
    port = authority if authority is not None else json.loads(
        R3_OPEN_REFRESH_AUTHORITY_PATH.read_text(encoding="utf-8"))
    if not isinstance(port, dict) or (
        port.get("contract") != "r3-coach-open-refresh-source-parity/1"
        or port.get("baseCommit") != R3_OPEN_REFRESH_BASE_SHA
        or port.get("target") != "public-dev" or port.get("targetBranch") != "dev"
        or port.get("baseVersion") != "1.0.554" or port.get("targetVersion") != "1.0.555"
        or port.get("baseReleaseId") != "2026.10.24.02" or port.get("targetReleaseId") != "2026.10.24.03"
        or port.get("memberCacheBefore") != 590 or port.get("memberCacheAfter") != 591
        or port.get("coachCacheBefore") != 563 or port.get("coachCacheAfter") != 564
    ):
        raise RuntimeError("R3 open refresh authority context mismatch")
    if port.get("bindingStatus") != "BOUND_TO_EXACT_FEATURE_RELEASE":
        raise RuntimeError("R3 open refresh candidate commit binding pending")
    feature, candidate = port.get("featureCommit"), port.get("candidateCommit")
    private = port.get("privateSource", {})
    if (feature != R3_OPEN_REFRESH_FEATURE_SHA or candidate != R3_OPEN_REFRESH_CANDIDATE_SHA
        or private.get("featureCommit") != "e224c6f36dc370c50ba29867d1ebca6e3939394b"
        or private.get("baseCommit") != "50d1c99497476aca1ed55d21419f89868f0e9872"
        or private.get("path") != "90-Dashboard/tennis-note-coach-app/app.js"
        or private.get("gitBlob") != "f26f248d66a6c7c172053ff381b0cdf9823fea08"
        or private.get("canonicalLfSha256") != "9ab940640f53b5c0a4c2b8dd1dc79e7a99dcef90c413074f22e9cb4c376b19c6"
        or private.get("basicFunctionSha256") != "f525532488903d1c90d4c9c46461548357904b2b7e6d064d0948f65d6d4db855"):
        raise RuntimeError("R3 open refresh source binding mismatch")
    for revision, expected in ((feature, R3_OPEN_REFRESH_BASE_SHA), (candidate, feature)):
        lineage = str(run_git("rev-list", "--parents", "-n", "1", revision)).split()
        if lineage != [revision, expected]:
            raise RuntimeError("R3 open refresh exact two-commit lineage mismatch")
    feature_paths = R3_OPEN_REFRESH_PRODUCTS | {"tests/r3-coach-settlement-open-refresh.test.js"}
    for revision, expected in ((feature, feature_paths), (candidate, R3_OPEN_REFRESH_RELEASE)):
        if set(str(run_git("diff-tree", "--no-commit-id", "--name-only", "-r", revision)).splitlines()) != expected:
            raise RuntimeError("R3 open refresh commit path set mismatch")
    files = port.get("files")
    if (not isinstance(files, list) or len(files) != len(R3_OPEN_REFRESH_PATHS)
        or any(not isinstance(row, dict) for row in files)
        or {row.get("path") for row in files} != R3_OPEN_REFRESH_PATHS):
        raise RuntimeError("R3 open refresh exact source paths mismatch")
    for row in files:
        path = row["path"]
        if set(row) != {"path", "beforeGitBlob", "afterGitBlob", "beforeSha256", "afterSha256", "hunks"}:
            raise RuntimeError("R3 open refresh source row shape mismatch")
        contents = {}
        for label, revision in (("before", R3_OPEN_REFRESH_BASE_SHA), ("after", candidate)):
            raw = run_git("show", f"{revision}:{path}", text=False)
            blob = hashlib.sha1(b"blob " + str(len(raw)).encode("ascii") + b"\0" + raw).hexdigest()
            canonical = raw.decode("utf-8").replace("\r\n", "\n")
            if blob != row[label + "GitBlob"] or sha256(canonical.encode()) != row[label + "Sha256"]:
                raise RuntimeError(f"R3 open refresh Git blob/hash mismatch: {path}")
            contents[label] = canonical
        hunks = row.get("hunks")
        if not isinstance(hunks, list) or not hunks:
            raise RuntimeError("R3 open refresh inverse hunks missing")
        restored = contents["after"]
        for hunk in reversed(hunks):
            if (not isinstance(hunk, dict) or set(hunk) != {"before", "after"}
                or not isinstance(hunk["after"], str) or not isinstance(hunk["before"], str)
                or not hunk["after"] or restored.count(hunk["after"]) != 1):
                raise RuntimeError(f"R3 open refresh inverse hunk mismatch: {path}")
            restored = restored.replace(hunk["after"], hunk["before"], 1)
        if restored != contents["before"]:
            raise RuntimeError(f"R3 open refresh inverse baseline mismatch: {path}")
    for revision, version, release_id in (
        (R3_OPEN_REFRESH_BASE_SHA, "1.0.554", "2026.10.24.02"),
        (candidate, "1.0.555", "2026.10.24.03"),
    ):
        release = json.loads(run_git("show", f"{revision}:app/release.json"))
        if release.get("version") != version or release.get("releaseId") != release_id:
            raise RuntimeError("R3 open refresh version/release mismatch")
    for relative, expected in (
        ("app/tennis-note-member-app/service-worker.js", "tennis-note-member-pwa-v591"),
        ("app/tennis-note-coach-app/service-worker.js", "tennis-note-coach-mode-v564"),
    ):
        source = str(run_git("show", f"{candidate}:{relative}"))
        if re.search(r'const CACHE_NAME = "([^"]+)";', source).group(1) != expected:
            raise RuntimeError("R3 open refresh cache mismatch")
    return port


def restore_r3_coach_open_refresh_base(
    path: str, text: str, authority: dict | None = None, *, strict: bool = True,
) -> str:
    """Exact 555 -> 554 outer inverse; historical inputs retain their own frozen route."""
    normalized = Path(path).as_posix()
    if normalized not in R3_OPEN_REFRESH_PATHS:
        return text
    port = _load_r3_coach_open_refresh_authority(authority)
    row = next(item for item in port["files"] if item["path"] == normalized)
    canonical = text.replace("\r\n", "\n")
    digest = sha256(canonical.encode())
    if digest == row["beforeSha256"]:
        return canonical
    if digest != row["afterSha256"]:
        if not strict:
            return text
        raise RuntimeError(f"R3 open refresh candidate hash drift: {normalized}")
    for hunk in reversed(row["hunks"]):
        if canonical.count(hunk["after"]) != 1:
            raise RuntimeError(f"R3 open refresh inverse hunk drift: {normalized}")
        canonical = canonical.replace(hunk["after"], hunk["before"], 1)
    if sha256(canonical.encode()) != row["beforeSha256"]:
        raise RuntimeError(f"R3 open refresh inverse baseline drift: {normalized}")
    return canonical


def restore_r3_manual_payout_successor_base(path: str, text: str, *, strict: bool = True) -> str:
    """Remove only the pinned 1.0.554 payout feature/release stack before older inverses."""
    text = restore_r3_coach_open_refresh_base(path, text, strict=strict)
    normalized = Path(path).as_posix()
    if normalized not in R3_MANUAL_PAYOUT_SOURCE_PATHS:
        return text
    _load_r3_manual_payout_release_authority()
    current = text.replace("\r\n", "\n").encode("utf-8")
    stage_blobs: dict[bytes, bytes] = {}
    for revision in (R3_MANUAL_PAYOUT_BASE_SHA, R3_MANUAL_PAYOUT_FEATURE_SHA, R3_MANUAL_PAYOUT_CANDIDATE_SHA):
        try:
            blob = run_git("show", f"{revision}:{normalized}", text=False)
        except subprocess.CalledProcessError:
            if revision != R3_MANUAL_PAYOUT_BASE_SHA:
                raise RuntimeError(f"R3 manual payout stage blob missing: {normalized}")
            continue
        canonical_blob = blob.replace(b"\r\n", b"\n")
        digest = hashlib.sha256(canonical_blob).digest()
        prior = stage_blobs.get(digest)
        if prior is not None and prior != canonical_blob:
            raise RuntimeError(f"R3 manual payout stage hash collision: {normalized}")
        stage_blobs[digest] = canonical_blob
    if hashlib.sha256(current).digest() not in stage_blobs:
        if not strict:
            return text
        raise RuntimeError(f"R3 manual payout source stage drift: {normalized}")
    base = run_git("show", f"{R3_MANUAL_PAYOUT_BASE_SHA}:{normalized}", text=False).replace(b"\r\n", b"\n")
    return base.decode("utf-8")


def restore_r3_basic_settlement_successor_base(
    path: str,
    text: str,
    authority: dict[str, object] | None = None,
) -> str:
    """Restore 1.0.552, 1.0.551, 1.0.550, then the pinned 1.0.549 successor delta."""
    normalized_path = Path(path).as_posix()
    pending_552 = _validate_r3_policy_552_content_authority(
        json.loads(R3_POLICY_552_AUTHORITY_PATH.read_text(encoding="utf-8"))
    )
    row_552 = next((item for item in pending_552["files"] if item["path"] == normalized_path), None)
    if row_552 is not None and sha256(text.replace("\r\n", "\n").encode("utf-8")) == row_552["afterSha256"]:
        text = restore_r3_coach_settlement_input_successor_base(normalized_path, text)
    pending_551 = _validate_r3_policy_551_content_authority(
        json.loads(R3_POLICY_551_AUTHORITY_PATH.read_text(encoding="utf-8"))
    )
    row_551 = next((item for item in pending_551["files"] if item["path"] == normalized_path), None)
    if row_551 is not None and sha256(text.replace("\r\n", "\n").encode("utf-8")) == row_551["afterSha256"]:
        text = restore_r3_hourly_input_successor_base(normalized_path, text)
    pending_550 = _validate_r3_policy_550_content_authority(
        json.loads(R3_POLICY_550_AUTHORITY_PATH.read_text(encoding="utf-8"))
    )
    pending_row = next((item for item in pending_550["files"] if item["path"] == normalized_path), None)
    if pending_row is not None and sha256(text.replace("\r\n", "\n").encode("utf-8")) == pending_row["afterSha256"]:
        text = restore_r3_coach_schedule_policy_successor_base(normalized_path, text)
    port = _load_r3_successor_authority(authority)
    row = next((item for item in port["files"] if item["path"] == normalized_path), None)
    if row is None:
        return text
    candidate_text = text.replace("\r\n", "\n")
    if sha256(candidate_text.encode("utf-8")) != row["afterSha256"]:
        raise RuntimeError(f"R3 successor candidate drift: {normalized_path}")
    for rule in row.get("replacements", []):
        candidate, base, count = rule.get("candidate"), rule.get("base"), rule.get("count")
        if not isinstance(candidate, str) or not candidate or not isinstance(base, str) or not isinstance(count, int) or count < 1:
            raise RuntimeError(f"R3 successor replacement authority invalid: {normalized_path}")
        if candidate_text.count(candidate) != count:
            raise RuntimeError(f"R3 successor replacement count drift: {normalized_path}")
        candidate_text = candidate_text.replace(candidate, base)
    for hunk in row.get("hunks", []):
        after, before = hunk.get("candidate"), hunk.get("base")
        if not isinstance(after, str) or not after or not isinstance(before, str) or hunk.get("count") != 1:
            raise RuntimeError(f"R3 successor hunk authority invalid: {normalized_path}")
        if candidate_text.count(after) != 1:
            raise RuntimeError(f"R3 successor exact hunk count drift: {normalized_path}")
        candidate_text = candidate_text.replace(after, before)
    if sha256(candidate_text.encode("utf-8")) != row["beforeSha256"]:
        raise RuntimeError(f"R3 successor restored baseline drift: {normalized_path}")
    return candidate_text


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
            "through the separate exact-function/shared hash manifest. The phone_exists guidance "
            "matches private 92c72e4c0d7da3c7893cfa03148ceb56f1966556 and changes only client "
            "error presentation. Settlement month, legacy media guidance, and neutral product labels "
            "match private 060ece0e4aff969c1d57c4246e9785c7bd40abc5 through the exact-function/shared "
            "hash manifest month-media-label-source-parity-20260922.json. Required product-family "
            "labels and blank product-name rejection match private "
            "6fdbacae737a7f1bfcf4fcf9e1d1168c5ed6dc4a; its additive settings validation migration is "
            "tracked in the private source and is not duplicated in this public product tree. Personal-journal "
            "video uploads up to 1 GiB, resumable transport, progress presentation, and signed private-video "
            "playback match the private c5884fab authority plus the current additive migration; database rollout "
            "remains a separate gate. The HEVC MP4 faststart preparation and signed-playback "
            "progress guidance match private 4f61594058a83f7a0be9afd5ef9163cfc486fa46; the "
            "iPhone playback still requires a separate actual-device gate. The journal reentry receipt, "
            "same-size selection isolation and media source-release correction matches private "
            "f408dae5c6918139c4d95067808b221439eb14da through the exact-function/shared hash manifest; "
            "actual iPhone decoding and audio remain a separate gate. The member profile completion "
            "decision matches the exact private main function in 46cc06ff3c97b4ec6496d890b64956ca57bc0b32 "
            "and trusts server-confirmed completion even when a synthetic QA profile has no phone. No R3 change. Local briefing-2 CUR02-05 keeps the remote reader off and actual content on hold; personal-journal OS sharing exposes only the controlled practice kind."
        ),
        "dev_ahead_commits": classify_commits(),
    }
    paths = sorted(
        set(authority_paths("app"))
        | {
            "app/shared/tennisnote-personal-journal.js",
            "app/shared/tennisnote-mp4-faststart.js",
            "app/shared/tennisnote-curriculum-contract.js",
            "app/shared/tennisnote-curriculum-reader.js",
            "app/shared/tennisnote-curriculum-ui.js",
        }
    )
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


def restore_purchase_identity_source(path: str, source: str, identity: dict) -> str:
    # 새 CSS 블록은 독립 해시와 단일 출현을 확인한 뒤에만 승인 hunk를 되돌린다.
    for style in identity["styleHunks"]:
        if style["file"] == path:
            block = style["text"]
            if source.count(block) != 1 or sha256(block.encode("utf-8")) != style["sha256"]:
                raise RuntimeError("purchase identity style authority hash drift")
    for hunk in identity["inverseHunks"].get(path, []):
        if source.count(hunk["after"]) != 1:
            raise RuntimeError("purchase identity hunk drift")
        source = source.replace(hunk["after"], hunk["before"], 1)
    return source


def restore_excel_retry_base(path: str, text: str) -> str:
    """원본과 일치하는 retry/refresh 증분만 역변환하며 기존 golden을 보존한다."""
    port = json.loads((ROOT / "tests/fixtures/excel-retry-source-parity.json").read_text(encoding="utf-8"))
    row = next((item for item in port["files"] if item["path"] == path), None)
    if row is None:
        return text
    if sha256(text.encode("utf-8")) != row["candidateSha256"]:
        raise RuntimeError("Excel retry candidate hash drift")
    for hunk in reversed(row["hunks"]):
        if text.count(hunk["after"]) != 1:
            raise RuntimeError("Excel retry hunk drift")
        text = text.replace(hunk["after"], hunk["before"], 1)
    if sha256(text.encode("utf-8")) != row["baseSha256"]:
        raise RuntimeError("Excel retry baseline drift")
    return text


def restore_r3_unlock_base(path: str, text: str, port: dict | None = None) -> str:
    """잠금 UI 증분만 exact 역변환하며 기존 제품 golden은 보존한다."""
    if port is None:
        port = json.loads((ROOT / "tests/fixtures/r3-admin-unlock-source-parity.json").read_text(encoding="utf-8"))
    entry = next((item for item in port["files"] if item["path"] == path), None)
    if entry is None:
        return text
    if sha256(text.encode("utf-8")) != entry["candidateSha256"]:
        raise RuntimeError("R3 unlock candidate hash drift")
    if len(entry["hunks"]) != 5:
        raise RuntimeError("R3 unlock inverse hunk count drift")
    for hunk in reversed(entry["hunks"]):
        if not hunk["after"] or text.count(hunk["after"]) != 1:
            raise RuntimeError("R3 unlock inverse hunk drift")
        text = text.replace(hunk["after"], hunk["before"], 1)
    if sha256(text.encode("utf-8")) != entry["baseSha256"]:
        raise RuntimeError("R3 unlock baseline hash drift")
    return text


def restore_r3_effective_base(path: str, text: str) -> str | None:
    """승인된 원본 projection만 exact hash/offset으로 역변환. 기존 golden은 불변."""
    port = json.loads((ROOT / "tests/fixtures/r3-effective-source-parity.json").read_text(encoding="utf-8"))
    text = restore_exact_outer_base(path, text, "r3-preview-identity-fence-source-parity.json", port["publicVersion"])
    text = restore_r3_unlock_base(path, text)
    admin_history = json.loads((ROOT / "tests/fixtures/r3-admin-history-source-parity.json").read_text(encoding="utf-8"))
    admin_entry = next((item for item in admin_history["files"] if item["path"] == path), None)
    if admin_entry is not None:
        text = text.replace(port["publicVersion"], admin_history["publicVersion"])
        if sha256(text.encode("utf-8")) != admin_entry["candidateSha256"]:
            raise RuntimeError("R3 admin history candidate hash drift")
        for hunk in reversed(admin_entry["hunks"]):
            if text[hunk["start"]:hunk["end"]] != hunk["after"]:
                raise RuntimeError("R3 admin history inverse hunk drift")
            text = text[:hunk["start"]] + hunk["before"] + text[hunk["end"]:]
        if sha256(text.encode("utf-8")) != admin_entry["baseSha256"]:
            raise RuntimeError("R3 admin history baseline drift")
        text = text.replace(admin_history["publicVersion"], port["publicVersion"])
    history = json.loads((ROOT / "tests/fixtures/r3-coach-history-source-parity.json").read_text(encoding="utf-8"))
    history_entry = next((item for item in history["files"] if item["path"] == path), None)
    if history_entry is not None:
        text = text.replace(port["publicVersion"], history["publicVersion"])
        if sha256(text.encode("utf-8")) != history_entry["candidateSha256"]:
            raise RuntimeError("R3 history candidate hash drift")
        for hunk in reversed(history_entry["hunks"]):
            if text[hunk["start"]:hunk["end"]] != hunk["after"]:
                raise RuntimeError("R3 history inverse hunk drift")
            text = text[:hunk["start"]] + hunk["before"] + text[hunk["end"]:]
        if sha256(text.encode("utf-8")) != history_entry["baseSha256"]:
            raise RuntimeError("R3 history baseline drift")
        text = text.replace(history["publicVersion"], port["publicVersion"])
    port = json.loads((ROOT / "tests/fixtures/r3-effective-source-parity.json").read_text(encoding="utf-8"))
    entry = next((item for item in port["files"] if item["path"] == path), None)
    if entry is None:
        return text
    if path == "app/tennis-note-coach-app/service-worker.js":
        text = text.replace(EXPECTED_COACH_CACHE, port["publicCoachCache"])
    if sha256(text.encode("utf-8")) != entry["candidateSha256"]:
        raise RuntimeError("R3 projection candidate hash drift")
    if entry["new"]:
        return None
    for hunk in reversed(entry["hunks"]):
        if text[hunk["start"]:hunk["end"]] != hunk["after"]:
            raise RuntimeError("R3 projection hunk drift")
        text = text[:hunk["start"]] + hunk["before"] + text[hunk["end"]:]
    if sha256(text.encode("utf-8")) != entry["baseSha256"]:
        raise RuntimeError("R3 projection baseline drift")
    if path == "app/tennis-note-coach-app/service-worker.js":
        text = text.replace(port["publicCoachCache"], EXPECTED_COACH_CACHE)
    return text


def restore_auth_dev_prepare_base(path: str, text: str) -> str:
    normalized = Path(path).as_posix()
    current_source = ROOT / normalized
    is_current_source = current_source.is_file() and current_source.read_text(encoding="utf-8").replace("\r\n", "\n") == text.replace("\r\n", "\n")
    text = restore_r3_manual_payout_successor_base(path, text, strict=is_current_source)
    pending_552 = _validate_r3_policy_552_content_authority(
        json.loads(R3_POLICY_552_AUTHORITY_PATH.read_text(encoding="utf-8"))
    )
    normalized_path = Path(path).as_posix()
    row_552 = next((item for item in pending_552["files"] if item["path"] == normalized_path), None)
    if row_552 is not None:
        digest_552 = sha256(text.replace("\r\n", "\n").encode("utf-8"))
        if digest_552 == row_552["afterSha256"]:
            text = restore_r3_coach_settlement_input_successor_base(normalized_path, text)
    pending_551 = _validate_r3_policy_551_content_authority(
        json.loads(R3_POLICY_551_AUTHORITY_PATH.read_text(encoding="utf-8"))
    )
    normalized_path = Path(path).as_posix()
    row_551 = next((item for item in pending_551["files"] if item["path"] == normalized_path), None)
    if row_551 is not None:
        digest_551 = sha256(text.replace("\r\n", "\n").encode("utf-8"))
        if digest_551 == row_551["afterSha256"]:
            text = restore_r3_hourly_input_successor_base(normalized_path, text)
        elif digest_551 not in {row_551["beforeSha256"], row_551["afterSha256"]}:
            # Earlier frozen candidates are normalized by their own exact authority below.
            pass
    # The frozen 1.0.549 artifact is the exact 1.0.550 before-blob. Preserve that
    # historical route, but require a real two-commit binding for any 1.0.550 after-blob.
    normalized_path = Path(path).as_posix()
    pending_550 = _validate_r3_policy_550_content_authority(
        json.loads(R3_POLICY_550_AUTHORITY_PATH.read_text(encoding="utf-8"))
    )
    row = next((item for item in pending_550["files"] if item["path"] == normalized_path), None)
    if row is not None:
        digest = sha256(text.replace("\r\n", "\n").encode("utf-8"))
        if digest == row["afterSha256"]:
            text = restore_r3_coach_schedule_policy_successor_base(normalized_path, text)
        elif digest != row["beforeSha256"]:
            raise RuntimeError(f"R3 550 source is neither pinned 1.0.549 nor exact 1.0.550: {normalized_path}")
    text = restore_r3_basic_settlement_successor_base(path, text)
    text = restore_development_checkout_history_base(path, text)
    return restore_auth_dev_prepare_base_legacy(path, text)


def restore_development_checkout_history_base(path: str, text: str, authority: dict[str, object] | None = None) -> str:
    """Remove only the pinned DEV checkout-history addition before frozen Auth normalization."""
    port = authority if authority is not None else json.loads(
        (ROOT / DEV_CHECKOUT_HISTORY_AUTHORITY_PATH).read_text(encoding="utf-8")
    )
    if not isinstance(port, dict) or port.get("contract") != "development-checkout-history-source-parity/1":
        raise RuntimeError("Development checkout-history authority contract invalid")
    files = port.get("files")
    if not isinstance(files, list) or len(files) != 1 or not isinstance(files[0], dict):
        raise RuntimeError("Development checkout-history authority file set invalid")
    row = files[0]
    if set(row) != {"path", "beforeSha256", "afterSha256", "hunks"} or row.get("path") != DEV_WORKFLOW:
        raise RuntimeError("Development checkout-history authority path invalid")
    before_hash, after_hash = row.get("beforeSha256"), row.get("afterSha256")
    if not re.fullmatch(r"[a-f0-9]{64}", str(before_hash or "")) or not re.fullmatch(r"[a-f0-9]{64}", str(after_hash or "")):
        raise RuntimeError("Development checkout-history authority hash invalid")
    if before_hash != DEV_CHECKOUT_HISTORY_BEFORE_SHA256:
        raise RuntimeError("Development checkout-history historical baseline invalid")
    hunks = row.get("hunks")
    if not isinstance(hunks, list) or len(hunks) != 1 or not isinstance(hunks[0], dict):
        raise RuntimeError("Development checkout-history authority hunk count invalid")
    hunk = hunks[0]
    expected_before = "          ref: ${{ github.sha }}\n"
    expected_after = expected_before + "          fetch-depth: 0\n"
    if set(hunk) != {"before", "after", "count"} or hunk.get("before") != expected_before or hunk.get("after") != expected_after or hunk.get("count") != 1:
        raise RuntimeError("Development checkout-history authority hunk invalid")
    normalized_path = Path(path).as_posix()
    if normalized_path != DEV_WORKFLOW:
        return text
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    digest = sha256(text.encode("utf-8"))
    if digest == before_hash:
        return text
    if digest != after_hash or text.count(expected_after) != 1:
        raise RuntimeError("Development checkout-history candidate drift")
    text = text.replace(expected_after, expected_before, 1)
    if sha256(text.encode("utf-8")) != before_hash:
        raise RuntimeError("Development checkout-history baseline drift")
    return text


def restore_auth_dev_prepare_base_legacy(path: str, text: str) -> str:
    """DEV 게시 준비의 exact 증분만 제거하고 기존 golden을 유지한다."""
    port = json.loads((ROOT / "tests/fixtures/auth-only-development-prepare-source-parity.json").read_text(encoding="utf-8"))
    row = next((item for item in port["files"] if item["path"] == path), None)
    if row is None:
        return text
    text = text.replace("\r\n", "\n")
    if sha256(text.encode("utf-8")) != row["afterSha256"]:
        raise RuntimeError(f"Auth DEV prepare candidate drift: {path}")
    for after, before in row["inverse"]:
        if not after or after not in text:
            raise RuntimeError(f"Auth DEV prepare inverse drift: {path}")
        text = text.replace(after, before)
    if sha256(text.encode("utf-8")) != row["beforeSha256"]:
        raise RuntimeError(f"Auth DEV prepare baseline drift: {path}")
    return text


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
    r3_port = json.loads((ROOT / "tests/fixtures/r3-effective-source-parity.json").read_text(encoding="utf-8"))
    for entry in r3_port["files"]:
        if entry["new"] and entry["path"].startswith("app/"):
            source = (ROOT / entry["path"]).read_text(encoding="utf-8").replace("\r\n", "\n")
            if restore_r3_effective_base(entry["path"], source) is not None:
                raise RuntimeError("R3 new-module baseline drift")
            actual_paths.remove(entry["path"])
    if actual_paths != sorted(expected_hashes):
        missing = sorted(set(expected_hashes) - set(actual_paths))
        extra = sorted(set(actual_paths) - set(expected_hashes))
        raise RuntimeError(f"product path drift: missing={missing[:5]} extra={extra[:5]}")
    mismatches = []
    # 승인 identity 이식만 역변환한다. 기존 제품 golden hash는 그대로 유지한다.
    identity = json.loads((ROOT / "tests/fixtures/purchase-identity-source-parity.json").read_text(encoding="utf-8"))
    for item in identity["functions"]:
        source = (ROOT / item["file"]).read_text(encoding="utf-8").replace("\r\n", "\n")
        match = re.search(r"(?:async )?function " + re.escape(item["name"]) + r"\([\s\S]*?\n\}", source)
        if not match or sha256(match.group().encode("utf-8")) != item["sha256"]:
            raise RuntimeError("purchase identity authority hash drift")
    # 승인된 import-only mapper만 역변환하고 나머지 golden은 보존한다.
    import_policy = json.loads((ROOT / "tests/fixtures/import-only-product-source-parity.json").read_text(encoding="utf-8"))
    import_source = (ROOT / import_policy["target"]).read_text(encoding="utf-8").replace("\r\n", "\n")
    import_match = re.search(r"function membershipProductFromServer\([\s\S]*?\n\}", import_source)
    if not import_match or sha256(re.sub(r"^\s*//.*\n", "", import_match.group(), flags=re.M).encode("utf-8")) != import_policy["mapperWithoutCommentsSha256"]:
        raise RuntimeError("import-only mapper authority hash drift")
    if import_source.count(import_policy["hunk"]) != 1:
        raise RuntimeError("import-only mapper hunk missing or duplicated")
    home = json.loads((ROOT / "tests/fixtures/member-home-source-parity.json").read_text(encoding="utf-8"))
    for path in actual_paths:
        data = (ROOT / path).read_bytes()
        try:
            data = restore_auth_dev_prepare_base(path, data.decode("utf-8")).encode("utf-8")
        except UnicodeDecodeError:
            pass
        try:
            signin_port = json.loads((ROOT / "tests/fixtures/development-signin-source-parity.json").read_text(encoding="utf-8"))
            phone_port = json.loads((ROOT / "tests/fixtures/verified-profile-phone-source-parity.json").read_text(encoding="utf-8"))
            text = data.decode("utf-8").replace("\r\n", "\n").replace(EXPECTED_VERSION, phone_port["publicVersion"])
            text = restore_verified_profile_phone_base(path, text)
            text = text.replace(phone_port["publicVersion"], signin_port["publicVersion"])
            text = restore_development_signin_base(path, text)
            text = text.replace(signin_port["publicVersion"], r3_port["publicVersion"])
            text = restore_r3_effective_base(path, text)
            text = text.replace(r3_port["publicVersion"], home["publicVersion"])
            text = restore_excel_retry_base(path, text)
            text = restore_member_home_base(path, text, home)
            text = restore_coach_round_base(path, text)
            data = restore_renewal_hold_base(path, text).replace(home["publicVersion"], EXPECTED_VERSION).encode("utf-8")
        except UnicodeDecodeError:
            pass
        if path == import_policy["target"]:
            data = data.decode("utf-8").replace("\r\n", "\n").replace(
                import_policy["hunk"], "  const savedStatus = row.policy_settings?.adminSaleStatus;"
            ).encode("utf-8")
        if path in identity["inverseHunks"]:
            text = data.decode("utf-8").replace("\r\n", "\n")
            text = restore_purchase_identity_source(path, text, identity)
            data = text.encode("utf-8")
        current_hash = sha256(normalize_product_bytes(path, data, manifest))
        if current_hash != expected_hashes[path]:
            mismatches.append(path)
    if mismatches:
        raise RuntimeError(f"product hash drift outside approved literals: {mismatches[:20]}")

    workflow = restore_auth_dev_prepare_base(DEV_WORKFLOW, (ROOT / DEV_WORKFLOW).read_text(encoding="utf-8")).encode("utf-8")
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
