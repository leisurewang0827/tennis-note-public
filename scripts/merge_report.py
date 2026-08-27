#!/usr/bin/env python3
"""origin/main 을 병합하기 전에, 저쪽이 무엇을 바꿨고 그게 지금 어디 있는지 본다.

우리는 app.js 를 수십 개 파일로 쪼갰다. 저쪽이 고친 함수가 우리 쪽에서는
다른 파일에 살고 있으므로, 충돌 마커만 보고 풀면 오판한다.
이 스크립트가 "저쪽이 고친 함수 → 우리 쪽 현재 위치" 표를 만들어 준다.

    ./scripts/merge_report.py                 # origin/main 기준
    ./scripts/merge_report.py origin/main     # 같음

먼저 `git fetch origin` 을 돌리세요. 이 스크립트는 아무것도 바꾸지 않습니다.
"""

from __future__ import annotations

import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DECL = re.compile(r"^(?:async\s+)?function\s+([A-Za-z0-9_$]+)\s*\(")

# 저쪽이 한 덩어리로 갖고 있는 파일. 우리는 이걸 쪼갰다.
SPLIT_SOURCES = [
    "app/admin/app.js",
    "app/tennis-note-member-app/app.js",
    "app/tennis-note-coach-app/app.js",
]


def git(*args: str) -> str:
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                          text=True, check=True).stdout


def functions(text: str) -> dict[str, str]:
    """최상위 함수를 뽑는다. 끝은 열 0 의 '}'."""
    lines = text.split("\n")
    out: dict[str, str] = {}
    index = 0
    while index < len(lines):
        match = DECL.match(lines[index])
        if not match:
            index += 1
            continue
        end = index + 1
        while end < len(lines) and lines[end] != "}":
            end += 1
        out[match.group(1)] = "\n".join(lines[index:end + 1])
        index = end + 1
    return out


def show(ref: str, path: str) -> str:
    result = subprocess.run(["git", "show", f"{ref}:{path}"], cwd=ROOT,
                            capture_output=True, text=True)
    return result.stdout if result.returncode == 0 else ""


def our_locations(app_dir: Path) -> dict[str, str]:
    """지금 우리 쪽에서 각 함수가 어느 파일에 사는지."""
    where: dict[str, str] = {}
    for path in sorted(app_dir.rglob("*.js")):
        if path.name == "service-worker.js":
            continue
        for name in functions(path.read_text(encoding="utf-8")):
            where[name] = path.relative_to(ROOT).as_posix()
    # 앱들이 함께 쓰는 것도 본다
    for path in sorted((ROOT / "app/shared").glob("*.js")):
        for name in functions(path.read_text(encoding="utf-8")):
            where.setdefault(name, path.relative_to(ROOT).as_posix())
    return where


def main() -> int:
    upstream = sys.argv[1] if len(sys.argv) > 1 else "origin/main"
    base = git("merge-base", upstream, "HEAD").strip()
    if not base:
        print(f"실패: {upstream} 을 찾지 못했습니다. git fetch origin 을 먼저 돌리세요.")
        return 1

    print(f"기준점  {git('log', '-1', '--format=%h %s', base).strip()}")
    print(f"저쪽    {git('log', '-1', '--format=%h %s', upstream).strip()}")
    ahead = git("rev-list", "--count", f"{base}..{upstream}").strip()
    print(f"저쪽에만 있는 커밋 {ahead}개\n")

    changed_files = git("diff", "--name-only", base, upstream).strip().split("\n")
    changed_files = [f for f in changed_files if f]

    handled = set()
    for source in SPLIT_SOURCES:
        if source not in changed_files:
            continue
        handled.add(source)
        app_dir = ROOT / Path(source).parent
        before, after = functions(show(base, source)), functions(show(upstream, source))
        where = our_locations(app_dir)

        modified = [n for n in after if n in before and after[n] != before[n]]
        added = [n for n in after if n not in before]
        removed = [n for n in before if n not in after]

        print(f"■ {source}")
        print(f"   저쪽 변경: 수정 {len(modified)} · 신규 {len(added)} · 삭제 {len(removed)}")
        if modified:
            print("   ── 수정된 함수와 우리 쪽 현재 위치 ──")
            for name in sorted(modified):
                place = where.get(name)
                if place is None:
                    note = "★우리 쪽에 없음 — 유실 확인 필요★"
                elif place == source:
                    note = "app.js 그대로 (충돌 풀면 됨)"
                else:
                    note = f"→ {place} (저쪽 본문으로 교체 후 바이트 대조)"
                print(f"     {name:42s} {note}")
        if added:
            print("   ── 신규 함수 (app.js 에 그대로 두면 됨) ──")
            for name in sorted(added):
                clash = where.get(name)
                extra = f"  ★이미 {clash} 에 같은 이름 있음★" if clash else ""
                print(f"     {name}{extra}")
        if removed:
            print("   ── 저쪽이 지운 함수 (우리 쪽에서도 지워야 함) ──")
            for name in sorted(removed):
                print(f"     {name:42s} 지금 {where.get(name, '없음')}")
        print()

    rest = [f for f in changed_files if f not in handled]
    if rest:
        print("■ 나머지 바뀐 파일")
        for f in rest:
            ours = git("diff", "--name-only", base, "HEAD", "--", f).strip()
            mark = "★양쪽 다 고침★" if ours else "우리는 안 건드림"
            print(f"     {f:48s} {mark}")

    print("\n끝나고 확인할 것: 중복 선언 0 · 유실 0 · ./scripts/verify.sh · 브라우저")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
