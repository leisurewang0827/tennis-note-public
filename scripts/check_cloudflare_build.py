from __future__ import annotations

import json
import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / "app" / "release.json").read_text(encoding="utf-8"))
member = json.loads((ROOT / "dist" / "member" / "release.json").read_text(encoding="utf-8"))
admin = json.loads((ROOT / "dist" / "admin" / "release.json").read_text(encoding="utf-8"))

assert source == member == admin
assert (ROOT / "dist" / "member" / "index.html").is_file()
assert (ROOT / "dist" / "admin" / "index.html").is_file()

member_worker = (ROOT / "dist" / "member" / "service-worker.js").read_text(encoding="utf-8")
coach_worker = (
    ROOT / "dist" / "member" / "tennis-note-coach-app" / "service-worker.js"
).read_text(encoding="utf-8")
assert re.search(r"tennis-note-member-pwa-v\d+", member_worker)
assert re.search(r"tennis-note-coach-mode-v\d+", coach_worker)

for config in (
    ROOT / "dist" / "member" / "shared" / "config.local.js",
    ROOT / "dist" / "admin" / "shared" / "config.local.js",
):
    text = config.read_text(encoding="utf-8")
    assert "service_role" not in text
    assert "PORTONE_API_SECRET" not in text

print(f"Public PWA CI passed for {source['version']} / {source['releaseId']}")
