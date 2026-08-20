#!/usr/bin/env python3
"""버전을 9개 파일에 한 번에 올린다.

앱 버전은 9개 파일 100곳 넘게 박혀 있다. 한 곳만 빠뜨리면 그 파일만
예전 캐시에 남아 사용자가 옛 화면을 본다. 손으로 맞추지 말고 이 스크립트를 쓴다.

    ./scripts/bump_release.py --next          # 끝자리 +1
    ./scripts/bump_release.py 1.0.380         # 버전 지정
    ./scripts/bump_release.py --next --dry-run  # 바꾸지 않고 무엇이 바뀔지만 본다

바꾸는 것과 바꾸지 않는 것을 구분한다. 아래 둘은 네이티브 배포 때 따로
움직이므로 건드리지 않는다. 이력에서도 항상 별도 커밋이었다.

    release.json          nativePlatforms.*  (preparedVersion 등)
    tennisnote-release.js nativeShell.*      (androidVersion 등)

끝나면 남은 옛 버전 문자열이 없는지 스스로 검사한다. 하나라도 남으면
아무것도 쓰지 않고 멈춘다.
"""

from __future__ import annotations

import argparse
import datetime as dt
import re
import sys
from pathlib import Path
from typing import Callable

Reader = Callable[[Path], str]

ROOT = Path(__file__).resolve().parent.parent
APP = ROOT / "app"
RELEASE_JSON = APP / "release.json"
RELEASE_JS = APP / "shared" / "tennisnote-release.js"
SERVICE_WORKERS = (
    APP / "tennis-note-member-app" / "service-worker.js",
    APP / "tennis-note-coach-app" / "service-worker.js",
)

KST = dt.timezone(dt.timedelta(hours=9))
SEMVER = re.compile(r"^\d+\.\d+\.\d+$")

# check_cloudflare_build.py 의 verify_version_consistency 와 같은 규칙이다.
# 둘이 어긋나면 이 스크립트가 만든 결과를 검사기가 거부한다.
VERSION_QUERY = re.compile(r"([^\"'\s()]*)\?v=(\d+\.\d+\.\d+)")


class BumpError(Exception):
    """사람이 읽고 무엇을 할지 알 수 있는 실패."""


def read_current() -> tuple[str, str]:
    """release.json 이 기준 원본이다."""
    text = RELEASE_JSON.read_text(encoding="utf-8")
    version = re.search(r'"version":\s*"([^"]+)"', text)
    release_id = re.search(r'"releaseId":\s*"([^"]+)"', text)
    if not version or not release_id:
        raise BumpError(f"{RELEASE_JSON.relative_to(ROOT)} 에서 version/releaseId 를 찾지 못했습니다.")
    return version.group(1), release_id.group(1)


def next_patch(version: str) -> str:
    major, minor, patch = version.split(".")
    return f"{major}.{minor}.{int(patch) + 1}"


def next_release_id(current: str, now: dt.datetime) -> str:
    """YYYY.MM.DD.NN — 같은 날이면 NN 을 올리고, 날이 바뀌면 01 부터."""
    today = now.strftime("%Y.%m.%d")
    if current.startswith(today + "."):
        return f"{today}.{int(current.rsplit('.', 1)[1]) + 1:02d}"
    return f"{today}.01"


def sub_once(text: str, pattern: str, replacement: str, where: str) -> tuple[str, int]:
    """정확히 한 번만 바뀌어야 하는 자리. 0번이나 2번이면 사고다."""
    updated, count = re.subn(pattern, replacement, text)
    if count != 1:
        raise BumpError(f"{where}: {count}곳이 맞았습니다 (1곳이어야 합니다). 파일 형식이 바뀌었는지 확인하세요.")
    return updated, count


def plan_release_json(old: str, new: str, release_id: str, deployed_at: str) -> tuple[Path, str, int]:
    text = RELEASE_JSON.read_text(encoding="utf-8")
    where = RELEASE_JSON.relative_to(ROOT)
    changed = 0
    for key, value in (
        ("version", new),
        ("appSurfaceVersion", new),
        ("releaseId", release_id),
        ("deployedAt", deployed_at),
    ):
        # 여는 따옴표까지 맞춰야 minimumVersion·preparedVersion 이 걸리지 않는다.
        text, count = sub_once(text, rf'"{key}":\s*"[^"]+"', f'"{key}": "{value}"', f"{where} 의 {key}")
        changed += count
    return RELEASE_JSON, text, changed


def plan_release_js(old: str, new: str, release_id: str, deployed_at: str) -> tuple[Path, str, int]:
    text = RELEASE_JS.read_text(encoding="utf-8")
    where = RELEASE_JS.relative_to(ROOT)
    changed = 0
    for key, value in (
        ("version", new),
        ("releaseId", release_id),
        ("appSurfaceVersion", new),
        ("deployedAt", deployed_at),
    ):
        # 들여쓰기 4칸으로 최상위만 잡는다. nativeShell 안의 version 은 6칸이라 비켜간다.
        text, count = sub_once(
            text,
            rf'(?m)^(    {key}: ")[^"]+(")',
            rf"\g<1>{value}\g<2>",
            f"{where} 의 {key}",
        )
        changed += count
    return RELEASE_JS, text, changed


def plan_version_queries(old: str, new: str, read: Reader) -> list[tuple[Path, str, int]]:
    """?v=1.2.3 형태를 전부 바꾼다. notion-catalog-3 같은 토큰은 대상이 아니다."""
    plans: list[tuple[Path, str, int]] = []
    stale: list[str] = []
    for path in sorted(APP.rglob("*")):
        if path.suffix not in {".html", ".js"} or not path.is_file():
            continue
        text = read(path)
        if "?v=" not in text:
            continue
        changed = 0

        def replace(match: re.Match[str]) -> str:
            nonlocal changed
            reference, found = match.group(1), match.group(2)
            # 외부 URL 과 vendor/ 아래 외부 라이브러리는 자기 버전을 쓴다.
            if "://" in reference or "/vendor/" in reference:
                return match.group(0)
            if found != old:
                stale.append(f"{path.relative_to(ROOT)}: {reference}?v={found}")
                return match.group(0)
            changed += 1
            return f"{reference}?v={new}"

        updated = VERSION_QUERY.sub(replace, text)
        if changed:
            plans.append((path, updated, changed))

    if stale:
        raise BumpError(
            "현재 버전과 다른 ?v= 가 이미 남아 있습니다. 먼저 이것부터 맞추세요:\n  "
            + "\n  ".join(sorted(set(stale)))
        )
    return plans


def plan_app_literals(old: str, new: str, read: Reader) -> list[tuple[Path, str, int]]:
    """?v= 가 아닌 형태로 버전이 박힌 자리.

    회원앱·코치앱 app.js 두 곳씩 있고, 지금 검사기가 못 잡는 자리다.
    """
    plans: list[tuple[Path, str, int]] = []
    for name in ("tennis-note-member-app", "tennis-note-coach-app"):
        path = APP / name / "app.js"
        text = read(path)
        changed = 0
        for pattern, replacement in (
            (rf'(\bv:\s*")({re.escape(old)})(")', rf"\g<1>{new}\g<3>"),
            (rf'(\|\|\s*")({re.escape(old)})(")', rf"\g<1>{new}\g<3>"),
        ):
            text, count = re.subn(pattern, replacement, text)
            changed += count
        if changed:
            plans.append((path, text, changed))
    return plans


def plan_cache_names(read: Reader) -> list[tuple[Path, str, int, str, str]]:
    """서비스워커 캐시 이름의 카운터를 +1 한다.

    이름이 그대로면 브라우저가 옛 캐시를 계속 쓴다. 버전 문자열과 별개의
    카운터라 검사기가 잡지 못하므로 여기서 반드시 같이 올린다.
    """
    plans: list[tuple[Path, str, int, str, str]] = []
    for path in SERVICE_WORKERS:
        text = read(path)
        match = re.search(r'(const CACHE_NAME = ")([a-z-]+-v)(\d+)(";)', text)
        if not match:
            raise BumpError(f"{path.relative_to(ROOT)}: CACHE_NAME 을 찾지 못했습니다.")
        prefix, counter = match.group(2), int(match.group(3))
        before, after = f"{prefix}{counter}", f"{prefix}{counter + 1}"
        updated = text[: match.start()] + f'{match.group(1)}{after}{match.group(4)}' + text[match.end():]
        plans.append((path, updated, 1, before, after))
    return plans


def leftover_old_version(texts: dict[Path, str], old: str) -> list[str]:
    """바꾼 뒤에도 옛 버전이 남았는지 본다.

    남아도 되는 자리(nativePlatforms, nativeShell, 스토어 버전)는 제외한다.
    """
    allowed_keys = (
        "preparedVersion",
        "minimumVersion",
        "latestVersion",
        "minimumNativeShellVersion",
        "androidVersion",
        "iosVersion",
    )
    leftovers: list[str] = []
    for path in sorted(APP.rglob("*")):
        if path.suffix not in {".html", ".js", ".json"} or not path.is_file():
            continue
        text = texts.get(path) or path.read_text(encoding="utf-8")
        for number, line in enumerate(text.splitlines(), start=1):
            if old not in line:
                continue
            if any(key in line for key in allowed_keys):
                continue
            # nativeShell 안의 version: 은 들여쓰기 6칸이라 구분된다.
            if re.match(r"^      version: ", line):
                continue
            leftovers.append(f"{path.relative_to(ROOT)}:{number}: {line.strip()}")
    return leftovers


def main() -> int:
    parser = argparse.ArgumentParser(
        description="앱 버전을 9개 파일에 한 번에 올립니다.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("version", nargs="?", help="올릴 버전 (예: 1.0.380)")
    parser.add_argument("--next", action="store_true", help="끝자리를 1 올립니다")
    parser.add_argument("--release-id", help="releaseId 를 직접 지정합니다 (기본: 오늘 날짜로 자동)")
    parser.add_argument("--dry-run", action="store_true", help="파일을 바꾸지 않고 무엇이 바뀔지만 보여줍니다")
    args = parser.parse_args()

    try:
        old_version, old_release_id = read_current()

        if args.next and args.version:
            raise BumpError("버전을 직접 적었으면 --next 는 쓰지 마세요. 둘 중 하나만 고르세요.")
        if args.next:
            new_version = next_patch(old_version)
        elif args.version:
            new_version = args.version
        else:
            raise BumpError(
                "올릴 버전을 정해 주세요.\n"
                f"  현재 버전은 {old_version} 입니다.\n"
                "  끝자리만 올리려면:  ./scripts/bump_release.py --next\n"
                "  버전을 지정하려면:  ./scripts/bump_release.py 1.0.380"
            )

        if not SEMVER.match(new_version):
            raise BumpError(f"버전 형식이 1.2.3 이어야 합니다: {new_version}")
        if new_version == old_version:
            raise BumpError(f"이미 {old_version} 입니다. 다른 버전을 적어 주세요.")

        now = dt.datetime.now(KST)
        release_id = args.release_id or next_release_id(old_release_id, now)
        deployed_at = now.replace(microsecond=0).isoformat()

        # 한 파일을 여러 단계가 함께 고친다 (예: 서비스워커는 ?v= 와 캐시 이름 둘 다).
        # 각 단계는 디스크가 아니라 앞 단계의 결과를 읽어야 한다. 아니면 뒤엣것이
        # 앞엣것을 덮는다.
        merged: dict[Path, str] = {}
        counts: dict[Path, int] = {}

        def read(path: Path) -> str:
            if path not in merged:
                merged[path] = path.read_text(encoding="utf-8")
            return merged[path]

        def absorb(plans: list[tuple[Path, str, int]]) -> None:
            for path, text, changed in plans:
                merged[path] = text
                counts[path] = counts.get(path, 0) + changed

        absorb([plan_release_json(old_version, new_version, release_id, deployed_at)])
        absorb([plan_release_js(old_version, new_version, release_id, deployed_at)])
        absorb(plan_version_queries(old_version, new_version, read))
        absorb(plan_app_literals(old_version, new_version, read))

        cache_plans = plan_cache_names(read)
        absorb([(path, text, changed) for path, text, changed, _b, _a in cache_plans])

        # read() 가 손대지 않은 파일까지 담아두므로, 실제로 바뀐 것만 남긴다.
        merged = {path: text for path, text in merged.items() if counts.get(path)}

        leftovers = leftover_old_version(merged, old_version)
        if leftovers:
            raise BumpError(
                f"옛 버전 {old_version} 이 남습니다. 이 스크립트가 모르는 자리입니다.\n"
                "  아래를 이 스크립트에 추가한 뒤 다시 돌리세요:\n  "
                + "\n  ".join(leftovers)
            )

        total = sum(counts.values())
        print(f"{old_version} → {new_version}")
        print(f"releaseId {old_release_id} → {release_id}")
        for path, before, after in ((p, b, a) for p, _t, _c, b, a in cache_plans):
            print(f"캐시 이름  {before} → {after}")
        print()
        for path in sorted(merged, key=lambda p: (-counts[p], str(p))):
            print(f"  {counts[path]:3d}곳  {path.relative_to(ROOT)}")
        print(f"  {'-' * 3}")
        print(f"  {total:3d}곳  {len(merged)}개 파일")

        if args.dry_run:
            print("\n--dry-run 이라 파일을 바꾸지 않았습니다.")
            return 0

        for path, text in merged.items():
            path.write_text(text, encoding="utf-8")

        print("\n바꿨습니다. 다음으로 검증하세요:")
        print("  ./scripts/verify.sh")
        return 0

    except BumpError as error:
        print(f"\n실패: {error}\n", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
