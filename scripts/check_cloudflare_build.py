from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit


# 아직 만들지 않은 페이지. 만들면 이 목록에서 지운다.
# 지우지 않으면 링크 검사가 계속 통과하므로, 빚을 여기 눈에 보이게 남겨둔다.
KNOWN_MISSING_PAGES = {
    # 가입 동의 화면의 "서비스 이용약관" 링크. 사업자 정보 확정 후 작성 필요.
    "/tennis-note-legal/terms.html",
}


class LocalAssetParser(HTMLParser):
    """페이지가 참조하는 같은 사이트 안의 경로를 모은다.

    script/link 뿐 아니라 a/img 도 본다. 예전에는 script/link 만 검사해서
    가입 화면의 약관 링크가 404 인 채로 배포됐다.
    """

    def __init__(self) -> None:
        super().__init__()
        self.references: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        wanted = {("script", "src"), ("link", "href"), ("a", "href"), ("img", "src")}
        for name, value in attrs:
            if value and (tag, name) in wanted:
                self.references.append(value)


def redirect_sources(artifact_root: Path) -> set[str]:
    """_redirects 로 처리되는 경로는 파일이 없어도 정상이다."""
    redirects = artifact_root / "_redirects"
    if not redirects.is_file():
        return set()
    sources = set()
    for line in redirects.read_text(encoding="utf-8").splitlines():
        parts = line.split()
        if len(parts) >= 2 and parts[0].startswith("/"):
            sources.add(parts[0])
    return sources


def verify_local_assets(page: Path, artifact_root: Path, allowed: set[str]) -> list[str]:
    parser = LocalAssetParser()
    parser.feed(page.read_text(encoding="utf-8"))
    root = artifact_root.resolve()
    page_url = "/" + page.relative_to(root).as_posix()
    problems: list[str] = []
    for reference in parser.references:
        parsed = urlsplit(reference)
        if parsed.scheme or parsed.netloc or not parsed.path:
            continue
        # urljoin 은 루트에서 ".." 를 만나면 앞 슬래시를 떨어뜨린다.
        # 브라우저는 루트에서 더 못 올라가고 멈추므로 여기서도 그렇게 맞춘다.
        resolved_path = "/" + urlsplit(urljoin(page_url, reference)).path.lstrip("/")
        target = (root / Path(unquote(resolved_path).lstrip("/"))).resolve()
        assert root == target or root in target.parents, f"Asset escaped the artifact root: {page} -> {reference}"
        if target.exists() or resolved_path in KNOWN_MISSING_PAGES:
            continue
        if any(
            resolved_path.startswith(source[:-1]) if source.endswith("*") else resolved_path == source
            for source in allowed
        ):
            continue
        problems.append(f"{page.relative_to(root)} -> {reference}")
    return problems


def verify_artifact_links(artifact_root: Path) -> None:
    root = artifact_root.resolve()
    allowed = redirect_sources(root)
    problems: list[str] = []
    for page in sorted(root.rglob("*.html")):
        problems.extend(verify_local_assets(page, root, allowed))
    assert not problems, "Missing local link targets:\n  " + "\n  ".join(problems)


def verify_version_consistency(repo_root: Path, expected: dict) -> None:
    """버전 문자열이 release.json 과 어긋나면 막는다.

    앱 버전은 지금 9개 파일 73곳에 손으로 박혀 있다. 한 곳만 빠뜨려도
    그 파일만 예전 캐시에 남아 사용자가 옛 화면을 보게 된다.
    (실제로 관리자만 옛 커리큘럼 카탈로그를 보던 사고가 있었다.)
    """
    version = expected["version"]
    problems: list[str] = []

    # ?v=1.2.3 형태만 본다. notion-catalog-3 같은 개별 토큰은 대상이 아니다.
    # 외부 URL 과 vendor/ 아래 외부 라이브러리는 자기 버전을 쓰므로 제외한다.
    semver_query = re.compile(r"([^\"'\s()]*)\?v=(\d+\.\d+\.\d+)")
    for path in sorted((repo_root / "app").rglob("*")):
        if path.suffix not in {".html", ".js"} or not path.is_file():
            continue
        for reference, found in set(semver_query.findall(path.read_text(encoding="utf-8"))):
            if "://" in reference or "/vendor/" in reference:
                continue
            if found != version:
                problems.append(
                    f"{path.relative_to(repo_root)}: {reference}?v={found} (release.json 은 {version})"
                )

    release_js = (repo_root / "app" / "shared" / "tennisnote-release.js").read_text(encoding="utf-8")
    for field in ("version", "releaseId", "appSurfaceVersion"):
        match = re.search(rf'{field}:\s*"([^"]+)"', release_js)
        assert match, f"tennisnote-release.js 에 {field} 가 없습니다"
        if match.group(1) != expected[field]:
            problems.append(
                f"app/shared/tennisnote-release.js: {field}={match.group(1)} (release.json 은 {expected[field]})"
            )

    assert not problems, "버전 문자열이 release.json 과 어긋납니다:\n  " + "\n  ".join(problems)


def payment_config(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.TENNIS_NOTE_PAYMENT_CONFIG\s*=\s*(\{[\s\S]*?\});", text)
    assert match, f"Payment configuration is missing: {path}"
    return json.loads(match.group(1))


ROOT = Path(__file__).resolve().parents[1]
source = json.loads((ROOT / "app" / "release.json").read_text(encoding="utf-8"))
member = json.loads((ROOT / "dist" / "member" / "release.json").read_text(encoding="utf-8"))
admin = json.loads((ROOT / "dist" / "admin" / "release.json").read_text(encoding="utf-8"))

assert source == member == admin
assert (ROOT / "dist" / "member" / "index.html").is_file()
assert (ROOT / "dist" / "admin" / "index.html").is_file()

verify_version_consistency(ROOT, source)
verify_artifact_links(ROOT / "dist" / "member")
verify_artifact_links(ROOT / "dist" / "admin")

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
    payment = payment_config(config)
    assert payment["mode"] == "tosspay_only"
    assert payment["allowedMethods"] == ["tosspay"]
    assert set(payment["channels"]) == {"tosspay"}
    assert payment["channels"]["tosspay"]

print(f"Public PWA CI passed for {source['version']} / {source['releaseId']}")
