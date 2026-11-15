#!/usr/bin/env python3
"""과거 배포 이식 계약을 그 계약의 고정 입력에서 재현합니다. 현재 앱 승인 검사가 아닙니다."""
import argparse
import io
import json
import os
from pathlib import Path
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
SOURCE = "b7fe326b6b750f9be47db7eca64b03577359090f"
TREE = "f6e3f569a4b5b1d483e0fcdc884af1f919c38f7c"
TESTS = (
    "tests/production-excel-refresh.test.js",
    "tests/production-isolation.test.js",
    "tests/r3-basic-refresh-production.test.js",
    "tests/r3-production-candidate.test.js",
    "tests/r3-production-promotion.test.js",
    "tests/r3-production-selected.test.js",
    "tests/self-profile-a-only.test.js",
)


def git(*args, cwd=ROOT):
    return subprocess.check_output(["git", *args], cwd=cwd)


def run():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--list", action="store_true")
    parser.add_argument("--alignment", action="store_true")
    args = parser.parse_args()
    if args.list:
        print(json.dumps(list(TESTS)))
        return 0
    if any(os.environ.get(key) for key in ("GIT_DIR", "GIT_WORK_TREE", "GIT_INDEX_FILE", "GIT_OBJECT_DIRECTORY")):
        raise RuntimeError("외부 Git 작업 경로 설정은 과거 검사에서 허용하지 않습니다")
    if git("rev-parse", SOURCE + "^{tree}").decode().strip() != TREE:
        raise RuntimeError("과거 원본 tree 불일치")
    print(f"HISTORICAL REPLAY ONLY: {SOURCE} / 1.0.558 (현재 앱·운영 배포 승인 아님)", flush=True)
    paths = git("ls-tree", "-r", "--name-only", "-z", SOURCE).decode("utf8").rstrip("\0").split("\0")
    if any("\n" in name or "\r" in name for name in paths):
        raise RuntimeError("과거 검사 파일 이름에 줄바꿈이 있습니다")
    requests = "".join(SOURCE + ":" + name + "\n" for name in paths).encode("utf8")
    blobs = io.BytesIO(subprocess.check_output(["git", "cat-file", "--batch"], input=requests, cwd=ROOT))
    objects = Path(git("rev-parse", "--git-path", "objects").decode().strip())
    if not objects.is_absolute():
        objects = ROOT / objects
    # 브랜치/작업트리가 아니라 폐기되는 검사 입력입니다. 원본 index/refs는 사용하지 않습니다.
    with tempfile.TemporaryDirectory(prefix="tn-historical-test-") as temporary:
        target = Path(temporary).resolve()
        for name in paths:
            destination = (target / name).resolve()
            if not destination.is_relative_to(target):
                raise RuntimeError("안전하지 않은 과거 검사 경로")
            header = blobs.readline().split()
            if len(header) != 3 or header[1] != b"blob":
                raise RuntimeError("과거 원본 blob 누락")
            destination.parent.mkdir(parents=True, exist_ok=True)
            destination.write_bytes(blobs.read(int(header[2])))
            if blobs.read(1) != b"\n":
                raise RuntimeError("과거 원본 blob 경계 오류")
        git("init", "-q", cwd=target)
        git("config", "core.autocrlf", "false", cwd=target)
        git("config", "core.filemode", "false", cwd=target)
        (target / ".git/info/attributes").write_bytes(b"* -text\n")
        (target / ".git/objects/info/alternates").write_bytes((objects.resolve().as_posix() + "\n").encode("utf8"))
        git("update-ref", "HEAD", SOURCE, cwd=target)
        git("read-tree", SOURCE, cwd=target)
        # 현재 검사와 역변환 구현을 사용합니다. 제품·golden·릴리스 도구·과거 workflow는 고정합니다.
        overlays = (*TESTS, "scripts/check_tennisnote_dev_prod_alignment.py")
        overlays += tuple(p.relative_to(ROOT).as_posix() for p in (ROOT / "tests/helpers").glob("*.cjs")
                          if (target / p.relative_to(ROOT)).exists())
        for relative in overlays:
            original = (target / relative).read_bytes()
            updated = (ROOT / relative).read_bytes().replace(b"\r\n", b"\n")
            if b"\r\n" in original:
                updated = updated.replace(b"\n", b"\r\n")
            (target / relative).write_bytes(updated)
        if git("diff", "--name-only", SOURCE, "--", "app", "tests/fixtures", cwd=target).strip():
            raise RuntimeError("과거 제품/golden 입력 변경: " + git("diff", "--stat", SOURCE, "--", "app", "tests/fixtures", cwd=target).decode())
        if args.alignment:
            command = [os.environ.get("TENNISNOTE_PYTHON", "python" if os.name == "nt" else "python3"),
                       "-B", "scripts/check_tennisnote_dev_prod_alignment.py"]
        else:
            command = ["node", "--test", "--test-reporter=spec", *[p for p in TESTS if not p.endswith("r3-production-selected.test.js")]]
        result = subprocess.run(command, cwd=target).returncode
        if not args.alignment:
            # 같은 파일의 현재 정산 오류/권한 검사는 verify_tests에서 현재 앱으로 별도 실행합니다.
            selected = subprocess.run(["node", "--test", "--test-reporter=spec",
                "--test-name-pattern=^(selected|new adapters|HTML/module)",
                "tests/r3-production-selected.test.js"], cwd=target)
            result = result or selected.returncode
        return result


if __name__ == "__main__":
    raise SystemExit(run())
