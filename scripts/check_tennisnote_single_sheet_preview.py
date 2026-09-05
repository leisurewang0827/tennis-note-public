"""CI entry: synthetic parser + read-only snapshot/bounded worker contracts."""
import os
from pathlib import Path
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]


def main():
    for name in ("check_tennisnote_single_sheet_import.cjs", "check_tennisnote_single_sheet_preview.cjs", "check_tennisnote_single_sheet_transport.cjs"):
        result = subprocess.run([os.environ.get("NODE_BINARY", "node"), str(ROOT / "scripts" / name)], cwd=ROOT, timeout=60, capture_output=True, text=True, encoding="utf-8")
        # Test messages are fixed codes, not assertion values or parsed source cells.
        for line in result.stdout.splitlines():
            if line.startswith("PASS ") or " assertions PASS" in line:
                print(line)
        if result.returncode:
            print("FAIL single-sheet synthetic contract", file=sys.stderr)
            return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
