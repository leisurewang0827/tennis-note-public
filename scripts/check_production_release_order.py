#!/usr/bin/env python3
"""첫 운영 배포 전 member/admin 일치 및 DEV > 후보 PROD > 현재 PROD 검사.

숫자 순서만 검사하며 기능 검증·source admission·운영 승인을 대신하지 않는다.
실행 URL/대상/건너뛰기 옵션은 없다. 재실행·부분 배포는 별도 복구 판단이 필요하다.
"""
from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime
from pathlib import Path

try:
    from check_r3_dev_deployment import _http_read, run_git
except Exception:
    # 의존 파일 누락·손상도 내부 경로나 내용 없이 차단하며 다른 reader로 우회하지 않는다.
    print("FAIL production_release_order dependency_unavailable")
    raise SystemExit(1) from None

ROOT = Path(__file__).resolve().parents[1]
REPOSITORY = "leisurewang0827/tennis-note-public"
WORKFLOW = "Deploy Tennis Note short URLs"
WORKFLOW_REF = f"{REPOSITORY}/.github/workflows/deploy-cloudflare-pages.yml@refs/heads/main"


class ReleaseOrderError(RuntimeError):
    pass


def require(condition: bool, code: str) -> None:
    if not condition:
        raise ReleaseOrderError(code)


def validate_context(env: dict[str, str], head: str) -> str:
    require(env.get("GITHUB_REPOSITORY") == REPOSITORY, "repository_mismatch")
    require(env.get("GITHUB_EVENT_NAME") in {"push", "workflow_dispatch"}, "event_not_allowed")
    require(env.get("GITHUB_REF") == "refs/heads/main" and env.get("GITHUB_REF_TYPE") == "branch", "main_branch_required")
    require(env.get("GITHUB_WORKFLOW_REF") == WORKFLOW_REF and env.get("GITHUB_WORKFLOW") == WORKFLOW, "workflow_mismatch")
    require(env.get("GITHUB_RUN_ATTEMPT") == "1", "first_attempt_required")
    sha = env.get("GITHUB_SHA", "")
    require(bool(re.fullmatch(r"[0-9a-f]{40}", sha)) and sha != "0" * 40 and sha == head, "checkout_sha_mismatch")
    return sha


def release_key(value: object) -> tuple[tuple[int, ...], tuple[int, ...], datetime]:
    require(isinstance(value, dict), "release_object_required")
    version, release_id, deployed_at = (value.get(key) for key in ("version", "releaseId", "deployedAt"))
    require(isinstance(version, str) and bool(re.fullmatch(r"(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)", version)), "version_invalid")
    require(value.get("appSurfaceVersion") == version, "surface_version_mismatch")
    require(isinstance(release_id, str) and bool(re.fullmatch(r"[0-9]{4}\.[0-9]{2}\.[0-9]{2}\.[0-9]{2,}", release_id)), "release_id_invalid")
    require(isinstance(deployed_at, str) and len(deployed_at) <= 40, "release_time_invalid")
    try:
        timestamp = datetime.fromisoformat(deployed_at)
    except ValueError:
        raise ReleaseOrderError("release_time_invalid") from None
    require(timestamp.tzinfo is not None, "release_timezone_required")
    return tuple(map(int, version.split("."))), tuple(map(int, release_id.split("."))), timestamp


def pair(member: object, admin: object, code: str):
    member_key, admin_key = release_key(member), release_key(admin)
    require(member == admin and member_key == admin_key, code)
    return member_key


def validate_order(built_member: object, built_admin: object, dev_member: object, dev_admin: object,
                   prod_member: object, prod_admin: object) -> None:
    candidate = pair(built_member, built_admin, "built_pair_mismatch")
    dev = pair(dev_member, dev_admin, "dev_pair_mismatch")
    prod = pair(prod_member, prod_admin, "production_pair_mismatch_or_partial_deploy")
    require(dev[0] > candidate[0], "development_must_be_strictly_ahead")
    require(candidate[0] > prod[0], "production_already_deployed_or_regressed")
    require(candidate[1] > prod[1] and candidate[2] >= prod[2], "production_metadata_not_forward")


def read_release(path: Path) -> object:
    try:
        # 빌드 산출물도 같은 제한을 적용하고 오류에 파일 내용은 출력하지 않는다.
        with path.open("rb") as stream:
            raw = stream.read(1_000_001)
        require(len(raw) <= 1_000_000, "built_release_too_large")
        return json.loads(raw.decode("utf-8"))
    except (OSError, UnicodeError, ValueError):
        raise ReleaseOrderError("built_release_unreadable") from None


def run_preflight() -> None:
    sha = validate_context(dict(os.environ), run_git("rev-parse", "HEAD"))
    member = read_release(ROOT / "dist/member/release.json")
    admin = read_release(ROOT / "dist/admin/release.json")
    pair(member, admin, "built_pair_mismatch")
    require(member == read_release(ROOT / "app/release.json"), "built_source_release_mismatch")
    # 기존 TLS 검증/redirect 거부/15초 timeout/1MB 한도를 그대로 재사용한다.
    # HTTP 502/503/504 및 일시 연결 오류만 기존 helper의 최대 1회 재시도 범위다.
    dev_member = _http_read("member_release", sha)
    dev_admin = _http_read("admin_release", sha)
    prod_member = _http_read("production_member_release", sha)
    prod_admin = _http_read("production_admin_release", sha)
    validate_order(member, admin, dev_member, dev_admin, prod_member, prod_admin)


def main() -> int:
    try:
        require(len(sys.argv) == 1, "arguments_not_allowed")
        run_preflight()
    except ReleaseOrderError as error:
        print("FAIL production_release_order " + str(error))
        return 1
    except Exception:
        print("FAIL production_release_order evidence_unavailable")
        return 1
    print("PASS production_release_order; functional_release_go_not_implied")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
