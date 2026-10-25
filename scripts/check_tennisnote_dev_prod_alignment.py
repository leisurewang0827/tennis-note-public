#!/usr/bin/env python3
"""Build and verify the 2026-09-16 public dev/production alignment manifest."""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import subprocess
import sys
import io
import tarfile
import importlib.util
from unittest.mock import patch
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SELF_PROFILE_CONTRACT = json.loads((ROOT / "tests/fixtures/self-profile-a-only.json").read_text(encoding="utf-8"))
R3_PROMOTION_CONTRACT = json.loads((ROOT / "tests/fixtures/r3-production-promotion.json").read_text(encoding="utf-8"))
R3_DEV_WORKFLOW_CONTRACT_PATH = ROOT / "tests/fixtures/r3-dev-deployment-workflow.json"
R3_DEV_WORKFLOW_GUARD_PATH = ROOT / "tests/fixtures/r3-dev-deployment-workflow-guard.json"
R3_PROMOTION_BASE = "686cc97d9676da2d16ca3cdfbd862dc9cd19434e"
R3_PROMOTION_FILE_COUNT = 35
R3_NEW_PATHS = {"app/shared/tennisnote-settlement-adjustment.js"}

# 새 BASIC 수정과 공식 릴리스만 검증하여 이전553 검사 앞으로 역변환한다.
BASIC_REFRESH_PATH = ROOT / "tests/fixtures/r3-basic-refresh-production.json"
BASIC_REFRESH_PRODUCTS = {
    "app/tennis-note-coach-app/ui/screens.js": (
        '  openCoachModal("coachSettlementModal");\n  void syncCoachSettlementHistoryFromServer();',
        '  openCoachModal("coachSettlementModal");\n  void syncCoachSettlementFromServer();\n  void syncCoachSettlementHistoryFromServer();',
    ),
    "app/tennis-note-coach-app/events/account.js": (
        '    if (!state.coachSettlement || state.coachSettlementError) void syncCoachSettlementFromServer();\n', "",
    ),
    "app/tennis-note-coach-app/events/delegated.js": (
        '      if (!state.coachSettlement || state.coachSettlementError) void syncCoachSettlementFromServer();\n', "",
    ),
}
BASIC_REFRESH_RELEASE_PATHS = {
    "app/release.json", "app/shared/tennisnote-release.js", "app/admin/index.html",
    "app/tennis-note-member-app/index.html", "app/tennis-note-member-app/service-worker.js",
    "app/tennis-note-member-app/app.js", "app/tennis-note-member-app/forms/common.js",
    "app/tennis-note-member-app/ui/screens.js", "app/tennis-note-coach-app/index.html",
    "app/tennis-note-coach-app/service-worker.js", "app/tennis-note-coach-app/app.js",
    "app/tennis-note-coach-app/domain/coaches.js", "app/tennis-note-coach-app/forms/common.js",
}
_basic_refresh_cache = None


def basic_refresh_plan(contract=None):
    """JSON의 새 해시만 신뢰하지 않고224 원본+exact3+변경 없는 공식 도구로 재계산."""
    c = contract if contract is not None else json.loads(BASIC_REFRESH_PATH.read_text(encoding="utf-8"))
    def require(condition, reason):
        if not condition:
            raise RuntimeError("BASIC refresh " + reason)
    digest = lambda text: hashlib.sha256(text.encode("utf-8")).hexdigest()
    require(set(c) == {"contract", "base", "privateAuthority", "release", "files"}, "schema")
    require(c["contract"] == "r3-basic-refresh-production/1" and c["base"] == "22456ce67bfcb475ef9f65e8bff826dc61e8eaca", "base")
    source = c["privateAuthority"]
    require(set(source) == {"main", "equivalentCommit", "tree", "path", "blob", "functionName", "functionSource", "functionSha256", "publicHistoryPreserved"}, "source schema")
    expected_source = {
        "main": "896872fd9999c99e77f932a93060febde4d0d062",
        "equivalentCommit": "e224c6f36dc370c50ba29867d1ebca6e3939394b",
        "tree": "fe071c03bcecb27953a3049d8506d1bae201566d",
        "path": "90-Dashboard/tennis-note-coach-app/app.js", "blob": "f26f248d66a6c7c172053ff381b0cdf9823fea08",
        "functionName": "openCoachSettlement", "functionSha256": "0f422857ca7f62be879541095878ba430e410db1a4c8d4873ee883a0b07b0e8c",
        "publicHistoryPreserved": "  void syncCoachSettlementHistoryFromServer();\n",
    }
    require(all(source.get(k) == v for k, v in expected_source.items()) and digest(source["functionSource"]) == source["functionSha256"], "private source")
    release = c["release"]
    require(set(release) == {"version", "releaseId", "deployedAt", "memberCache", "coachCache", "runtime", "fingerprint", "originPolicy", "officialReplacementCount"}, "release schema")
    expected_release = {
        "version": "1.0.556", "releaseId": "2026.10.25.01", "memberCache": "tennis-note-member-pwa-v590",
        "coachCache": "tennis-note-coach-mode-v563", "runtime": "production",
        "fingerprint": "3b5646933760625e785b2bffbb463032add55c53f7ae85a98eb58ba9550e0a9a",
        "originPolicy": "production-origin-monotonic-independent-of-dev", "officialReplacementCount": 374,
    }
    require(all(release.get(k) == v for k, v in expected_release.items()) and re.fullmatch(r"2026-10-25T\d{2}:\d{2}:\d{2}\+09:00", release["deployedAt"]), "release/cache/scope")
    paths = [row["path"] for row in c["files"]]
    expected_paths = set(BASIC_REFRESH_PRODUCTS) | BASIC_REFRESH_RELEASE_PATHS
    require(len(paths) == len(set(paths)) and set(paths) == expected_paths, "exact path set")
    require(all(set(row) == {"path", "baseBlob", "baseSha256", "candidateSha256"} for row in c["files"]), "row schema")
    archive = subprocess.check_output(["git", "archive", c["base"], "app"], cwd=ROOT)
    with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
        originals = {m.name: tar.extractfile(m).read().decode("utf-8").replace("\r\n", "\n")
                     for m in tar.getmembers() if m.isfile() and Path(m.name).suffix in {".js", ".json", ".html"}}
    planned = dict(originals)
    for name, (before, after) in BASIC_REFRESH_PRODUCTS.items():
        require(planned[name].count(before) == 1, "product hunk")
        planned[name] = planned[name].replace(before, after)
    screen = planned["app/tennis-note-coach-app/ui/screens.js"]
    start = screen.index("function openCoachSettlement(")
    end = screen.index("\n}", start) + 2
    require(screen[start:end].replace(source["publicHistoryPreserved"], "") == source["functionSource"], "function projection")
    bump_path = ROOT / "scripts/bump_release.py"
    require(bump_path.read_bytes().replace(b"\r\n", b"\n") == subprocess.check_output(["git", "show", c["base"] + ":scripts/bump_release.py"], cwd=ROOT).replace(b"\r\n", b"\n"), "official tool drift")
    spec = importlib.util.spec_from_file_location("basic_refresh_official_bump", bump_path)
    bump = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(bump)
    def original(p, *args, **kwargs):
        name = p.relative_to(ROOT).as_posix()
        if name == "app/shared/config.local.js":
            return ""  # 배포 시 설정 원문은 읽지 않는다.
        require(name in planned, "unknown app path")
        return planned[name]
    merged, counts = {}, {}
    def read(p):
        return merged[p] if p in merged else original(p)
    def absorb(items):
        for p, text, count in items:
            merged[p] = text
            counts[p] = counts.get(p, 0) + count
    with patch.object(Path, "read_text", original):
        absorb([bump.plan_release_json("1.0.553", release["version"], release["releaseId"], release["deployedAt"])])
        absorb([bump.plan_release_js("1.0.553", release["version"], release["releaseId"], release["deployedAt"])])
        absorb(bump.plan_version_queries("1.0.553", release["version"], read))
        absorb(bump.plan_app_literals("1.0.553", release["version"], read))
        caches = bump.plan_cache_names(read)
        require([row[4] for row in caches] == [release["memberCache"], release["coachCache"]], "official caches")
        absorb([(p, text, count) for p, text, count, _, _ in caches])
    generated = {p.relative_to(ROOT).as_posix(): text for p, text in merged.items() if counts[p]}
    require(set(generated) == BASIC_REFRESH_RELEASE_PATHS and sum(counts.values()) == 374, "official release plan")
    planned.update(generated)
    require(json.loads(originals["app/release.json"])["nativePlatforms"] == json.loads(planned["app/release.json"])["nativePlatforms"], "native metadata")
    result = {}
    for row in c["files"]:
        name = row["path"]
        before, after = originals[name], planned[name]
        blob = hashlib.sha1(b"blob " + str(len(before.encode())).encode() + b"\0" + before.encode()).hexdigest()
        require(blob == row["baseBlob"] and digest(before) == row["baseSha256"] and digest(after) == row["candidateSha256"], "mechanical blob/hash: " + name)
        result[name] = {"before": before, "after": after}
    return result


def before_basic_refresh_candidate(path: str, data: bytes) -> bytes:
    global _basic_refresh_cache
    if _basic_refresh_cache is None:
        _basic_refresh_cache = basic_refresh_plan()
    row = _basic_refresh_cache.get(path)
    if row is None:
        return data
    candidate = data.decode("utf-8").replace("\r\n", "\n")
    if candidate != row["after"]:
        raise RuntimeError("BASIC refresh exact candidate mismatch: " + path)
    return row["before"].encode("utf-8")


def before_r3_candidate(path: str, data: bytes) -> bytes:
    """R3 공개 후보는 공용 exact SHA 계약으로 기준 tree에 복원한다."""
    data = before_basic_refresh_candidate(path, data)
    row = next((item for item in R3_PROMOTION_CONTRACT["files"] if item["path"] == path), None)
    if not row:
        return data
    try:
        candidate = data.decode("utf-8").replace("\r\n", "\n").encode("utf-8")
    except UnicodeDecodeError as exc:
        raise RuntimeError(f"R3 candidate is not UTF-8 text: {path}") from exc
    if sha256(candidate) != row["candidateSha256"]:
        raise RuntimeError(f"R3 promotion exact candidate mismatch: {path}")
    if row["baseSha256"] is None:
        return b""
    base = run_git("show", f"{R3_PROMOTION_CONTRACT['base']}:{path}", text=False)
    assert isinstance(base, bytes)
    base = base.replace(b"\r\n", b"\n")
    if sha256(base) != row["baseSha256"]:
        raise RuntimeError(f"R3 promotion exact base mismatch: {path}")
    return base


def before_r3_dev_workflow(data: bytes) -> bytes:
    """새 개발 배포 guard만 정확히 되돌린 뒤 역사적 4줄 검사를 재사용한다."""
    contract = json.loads(R3_DEV_WORKFLOW_GUARD_PATH.read_text(encoding="utf-8"))
    if set(contract) != {"path", "base", "baseSha256", "candidateSha256"}:
        raise RuntimeError("R3 development workflow guard schema mismatch")
    if contract["path"] != DEV_WORKFLOW or contract["base"] != R3_PROMOTION_BASE:
        raise RuntimeError("R3 development workflow guard scope mismatch")
    candidate = data.decode("utf-8").replace("\r\n", "\n").encode("utf-8")
    if sha256(candidate) != contract["candidateSha256"]:
        raise RuntimeError("R3 development workflow guard candidate drift")
    base = run_git("show", f"{contract['base']}:{DEV_WORKFLOW}", text=False)
    assert isinstance(base, bytes)
    base = base.replace(b"\r\n", b"\n")
    if sha256(base) != contract["baseSha256"]:
        raise RuntimeError("R3 development workflow guard base drift")
    return base


def before_self_profile_candidate(path: str, data: bytes) -> bytes:
    """검증된 증분만 역변환. 기존 운영 golden/hash는 변경하지 않는다."""
    data = before_r3_candidate(path, data)
    try:
        text = data.decode("utf-8").replace("\r\n", "\n")
    except UnicodeDecodeError:
        return data
    release_row = next((row for row in SELF_PROFILE_CONTRACT["release"]["files"] if row["path"] == path), None)
    if release_row:
        if hashlib.sha256(text.encode()).hexdigest() != release_row["afterHash"]:
            raise RuntimeError(f"self profile release candidate drift: {path}")
        for item in reversed(release_row["patches"]):
            if not item["after"] or text.count(item["after"]) != 1:
                raise RuntimeError(f"self profile release inverse drift: {path}")
            text = text.replace(item["after"], item["before"])
        if hashlib.sha256(text.encode()).hexdigest() != release_row["beforeHash"]:
            raise RuntimeError(f"self profile release baseline drift: {path}")
    row = next((row for row in SELF_PROFILE_CONTRACT["files"] if row["path"] == path), None)
    if row:
        if hashlib.sha256(text.encode()).hexdigest() != row["afterHash"]:
            raise RuntimeError(f"self profile candidate drift: {path}")
        for item in reversed(row["patches"]):
            if not item["after"] or text.count(item["after"]) != 1:
                raise RuntimeError(f"self profile exact inverse drift: {path}")
            text = text.replace(item["after"], item["before"])
        if hashlib.sha256(text.encode()).hexdigest() != row["beforeHash"]:
            raise RuntimeError(f"self profile baseline drift: {path}")
    return text.encode("utf-8")
MANIFEST_PATH = ROOT / "docs" / "tennisnote-dev-prod-alignment-20260916.json"
AUTHORITY_SHA = "10489623686b29a133ed8e64e76f0587e78c9faf"
DEV_SHA = "14c2901f8c4278810d49c222d4adc09aaaa06ae2"
MERGE_BASE_SHA = "c7cd00d532a9edfa9bc420c631ea8547f00e84ea"

EXPECTED_VERSION = "1.0.536"
EXPECTED_RELEASE_ID = "2026.10.06.04"
EXPECTED_MEMBER_CACHE = "tennis-note-member-pwa-v563"
EXPECTED_COACH_CACHE = "tennis-note-coach-mode-v536"

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
)
SELECTED_NET_NEW_PATHS = {
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


def validate_r3_promotion_contract() -> None:
    if set(R3_PROMOTION_CONTRACT) != {"base", "files"}:
        raise RuntimeError("R3 promotion manifest schema mismatch")
    if R3_PROMOTION_CONTRACT["base"] != R3_PROMOTION_BASE:
        raise RuntimeError("R3 promotion base mismatch")
    rows = R3_PROMOTION_CONTRACT["files"]
    if not isinstance(rows, list) or len(rows) != R3_PROMOTION_FILE_COUNT:
        raise RuntimeError("R3 promotion file count mismatch")
    paths = []
    removed = set()
    for row in rows:
        if set(row) != {"path", "baseSha256", "candidateSha256"}:
            raise RuntimeError("R3 promotion row schema mismatch")
        path = row["path"]
        if not isinstance(path, str) or not path.startswith("app/") or ".." in Path(path).parts:
            raise RuntimeError("R3 promotion path invalid")
        paths.append(path)
        if row["baseSha256"] is None:
            removed.add(path)
        elif not isinstance(row["baseSha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", row["baseSha256"]):
            raise RuntimeError("R3 promotion base SHA invalid")
        if not isinstance(row["candidateSha256"], str) or not re.fullmatch(r"[0-9a-f]{64}", row["candidateSha256"]):
            raise RuntimeError("R3 promotion candidate SHA invalid")
    if len(paths) != len(set(paths)):
        raise RuntimeError("R3 promotion paths are not unique")
    if removed != R3_NEW_PATHS:
        raise RuntimeError("R3 promotion new-path set mismatch")


validate_r3_promotion_contract()


def authority_bytes(path: str) -> bytes:
    return run_git("show", f"{AUTHORITY_SHA}:{path}", text=False)


def authority_paths(prefix: str) -> list[str]:
    output = run_git("ls-tree", "-r", "--name-only", AUTHORITY_SHA, prefix)
    return sorted(line for line in str(output).splitlines() if line)


def release_metadata(path: Path) -> dict[str, str]:
    data = json.loads(before_self_profile_candidate(path.relative_to(ROOT).as_posix(), path.read_bytes()).decode("utf-8"))
    return {
        "version": str(data["version"]),
        "release_id": str(data["releaseId"]),
        "deployed_at": str(data["deployedAt"]),
    }


def normalize_product_bytes(path: str, data: bytes, manifest: dict[str, object]) -> bytes:
    data = before_self_profile_candidate(path, data)
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
    text = before_self_profile_candidate(path.relative_to(ROOT).as_posix(), path.read_bytes()).decode("utf-8")
    match = re.search(r'^const CACHE_NAME = "([^"]+)";', text, re.M)
    if not match:
        raise RuntimeError(f"CACHE_NAME not found: {path}")
    return match.group(1)


def product_app_paths() -> list[str]:
    discovered_paths = sorted(
        path.relative_to(ROOT).as_posix()
        for path in (ROOT / "app").rglob("*")
        if path.is_file() and path.name != "config.local.js"
    )
    for path in sorted(R3_NEW_PATHS):
        if path not in discovered_paths:
            raise RuntimeError(f"expected R3 new source missing: {path}")
        # Only after the exact candidate hash passes may this one additive
        # source be removed from the frozen pre-R3 product-tree comparison.
        if before_r3_candidate(path, (ROOT / path).read_bytes()) != b"":
            raise RuntimeError(f"R3 new source inverse did not empty: {path}")
    return [path for path in discovered_paths if path not in R3_NEW_PATHS]


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
            "and trusts server-confirmed completion even when a synthetic QA profile has no phone. No R3 change."
        ),
        "dev_ahead_commits": classify_commits(),
    }
    paths = sorted(
        set(authority_paths("app"))
        | {
            "app/shared/tennisnote-personal-journal.js",
            "app/shared/tennisnote-mp4-faststart.js",
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
    actual_paths = product_app_paths()
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

    workflow = before_r3_dev_workflow((ROOT / DEV_WORKFLOW).read_bytes())
    workflow_text = workflow.decode("utf-8").replace("\r\n", "\n")
    for line in DEV_WORKFLOW_LINES:
        if workflow_text.splitlines().count(line) != 1:
            raise RuntimeError(f"development workflow line missing or duplicated: {line}")
    expected_workflow_hash = manifest["development_workflow"]["authority_sha256_without_dev_lines"]
    authority_workflow_hash = sha256(workflow_normalized(authority_bytes(DEV_WORKFLOW)))
    if authority_workflow_hash != expected_workflow_hash:
        raise RuntimeError("development workflow authority baseline mismatch")

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
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument("--generate", action="store_true")
    mode.add_argument("--verify", action="store_true")
    args = parser.parse_args()
    try:
        generate() if args.generate else verify()
    except (OSError, RuntimeError, ValueError, subprocess.CalledProcessError, KeyError, json.JSONDecodeError) as exc:
        print(f"alignment FAIL: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
