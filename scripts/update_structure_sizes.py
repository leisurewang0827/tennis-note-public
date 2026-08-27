#!/usr/bin/env python3
"""docs/structure.md 맨 위의 규모 표를 실측으로 다시 쓴다.

    ./scripts/update_structure_sizes.py

이 스크립트가 있는 이유: 예전에 임시 스크립트로 표를 갱신하다가 **행 모양이
같은 다른 표("폴더가 뜻하는 것")까지 덮어써서** 폴더 정의가 크기 숫자로
바뀐 사고가 있었습니다. 그래서 여기서는 문서 맨 위 첫 번째 표만,
"⚠ 위 숫자는" 문장 앞까지만 건드립니다. 그 밖은 한 글자도 안 바꿉니다.
"""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DOC = ROOT / "docs" / "structure.md"

APPS = [
    ("회원앱", "app/tennis-note-member-app"),
    ("코치앱", "app/tennis-note-coach-app"),
    ("관리자", "app/admin"),
]
LAYERS = ["domain", "views", "actions", "forms", "data", "events", "ui"]
FILES = ["catalog.js", "storage.js", "settings.js", "app.js"]


def measure(app, name):
    d = ROOT / app / name
    if d.is_dir():
        files = sorted(d.glob("*.js"))
        lines = sum(len(f.read_text(encoding="utf-8").split("\n")) - 1 for f in files)
        return f"{len(files)}개 {lines:,}줄"
    f = ROOT / app / name
    if f.exists():
        return f"{len(f.read_text(encoding='utf-8').split(chr(10))) - 1:,}줄"
    return "—"


def build_table():
    rows = ["| | " + " | ".join(n for n, _ in APPS) + " |", "|---|---|---|---|"]
    for lay in LAYERS:
        rows.append(f"| `{lay}/` | " + " | ".join(measure(a, lay) for _, a in APPS) + " |")
    for name in FILES:
        bold = "**" if name == "app.js" else ""
        cells = " | ".join(f"{bold}{measure(a, name)}{bold}" for _, a in APPS)
        rows.append(f"| {bold}`{name}`{bold} | " + cells + " |")
    return "\n".join(rows)


def main():
    text = DOC.read_text(encoding="utf-8")
    # 첫 표만: 첫 "| | 회원앱" 부터 그 표가 끝나는 빈 줄까지.
    match = re.search(r"^\| \| 회원앱.*?(?=\n\n)", text, re.S | re.M)
    if not match:
        raise SystemExit("규모 표를 못 찾았습니다. 문서 구조가 바뀌었으면 이 스크립트도 고치세요.")
    guard = "⚠ **위 숫자는"
    if guard not in text[match.end():match.end() + 200]:
        raise SystemExit("표 다음에 있어야 할 단서 문장이 없습니다. 엉뚱한 표를 잡은 것 같아 멈춥니다.")
    new = text[:match.start()] + build_table() + text[match.end():]
    if new == text:
        print("이미 최신입니다.")
        return
    DOC.write_text(new, encoding="utf-8")
    print("docs/structure.md 규모 표를 갱신했습니다.")


if __name__ == "__main__":
    main()
