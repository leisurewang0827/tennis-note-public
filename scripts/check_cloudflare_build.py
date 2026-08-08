from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit


class LocalAssetParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.references: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if value and ((tag == "script" and name == "src") or (tag == "link" and name == "href")):
                self.references.append(value)


def verify_local_assets(index: Path, artifact_root: Path) -> None:
    parser = LocalAssetParser()
    parser.feed(index.read_text(encoding="utf-8"))
    root = artifact_root.resolve()
    index_url = "/" + index.relative_to(root).as_posix()
    for reference in parser.references:
        parsed = urlsplit(reference)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        resolved_path = urlsplit(urljoin(index_url, reference)).path
        target = (root / Path(unquote(resolved_path).lstrip("/"))).resolve()
        assert root == target or root in target.parents, f"Asset escaped the artifact root: {index} -> {reference}"
        assert target.exists(), f"Missing local asset: {index} -> {reference}"


ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / "app" / "release.json").read_text(encoding="utf-8"))
member = json.loads((ROOT / "dist" / "member" / "release.json").read_text(encoding="utf-8"))
admin = json.loads((ROOT / "dist" / "admin" / "release.json").read_text(encoding="utf-8"))

assert source == member == admin
assert (ROOT / "dist" / "member" / "index.html").is_file()
assert (ROOT / "dist" / "admin" / "index.html").is_file()

verify_local_assets(ROOT / "dist" / "member" / "index.html", ROOT / "dist" / "member")
verify_local_assets(
    ROOT / "dist" / "member" / "tennis-note-coach-app" / "index.html",
    ROOT / "dist" / "member",
)
verify_local_assets(ROOT / "dist" / "admin" / "index.html", ROOT / "dist" / "admin")

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
