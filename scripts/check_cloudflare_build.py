from __future__ import annotations

import json
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urljoin, urlsplit


KNOWN_MISSING_PAGES: set[str] = set()


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

    앱 버전은 9개 파일 100곳 넘게 박혀 있다. 한 곳만 빠뜨려도 그 파일만
    예전 캐시에 남아 사용자가 옛 화면을 보게 된다.
    (실제로 관리자만 옛 커리큘럼 카탈로그를 보던 사고가 있었다.)

    손으로 맞추지 말고 scripts/bump_release.py 를 쓴다.
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

    # ?v= 가 아닌 형태로 버전이 박힌 자리. 위의 semver_query 가 비켜가므로
    # 따로 본다. 실제로 bump 스크립트를 만들면서 여기가 빈 것을 발견했다.
    # app/ 아래 전체를 본다. app.js 두 개만 보면 파일을 쪼갤 때 놓친다.
    literal_patterns = (
        # new URLSearchParams({ v: "1.2.3" })
        re.compile(r'\bv:\s*"(\d+\.\d+\.\d+)"'),
        # window.TENNIS_NOTE_RELEASE?.version || "1.2.3"
        re.compile(r'\?\.version\s*\|\|\s*"(\d+\.\d+\.\d+)"'),
    )
    for path in sorted((repo_root / "app").rglob("*.js")):
        if not path.is_file() or "/vendor/" in path.as_posix():
            continue
        text = path.read_text(encoding="utf-8")
        for pattern in literal_patterns:
            for found in set(pattern.findall(text)):
                if found != version:
                    problems.append(
                        f"{path.relative_to(repo_root)}: \"{found}\" (release.json 은 {version})"
                    )

    release_js = (repo_root / "app" / "shared" / "tennisnote-release.js").read_text(encoding="utf-8")
    for field in ("version", "releaseId", "appSurfaceVersion"):
        match = re.search(rf'{field}:\s*"([^"]+)"', release_js)
        assert match, f"tennisnote-release.js 에 {field} 가 없습니다"
        if match.group(1) != expected[field]:
            problems.append(
                f"app/shared/tennisnote-release.js: {field}={match.group(1)} (release.json 은 {expected[field]})"
            )

    assert not problems, (
        "버전 문자열이 release.json 과 어긋납니다:\n  "
        + "\n  ".join(problems)
        + "\n\n  손으로 고치지 말고 아래를 돌리세요:"
        + f"\n    ./scripts/bump_release.py {version}"
    )


def payment_config(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.TENNIS_NOTE_PAYMENT_CONFIG\s*=\s*(\{[\s\S]*?\});", text)
    assert match, f"Payment configuration is missing: {path}"
    return json.loads(match.group(1))


def browser_config(path: Path) -> dict:
    text = path.read_text(encoding="utf-8")
    match = re.search(r"window\.TENNISNOTE_CONFIG\s*=\s*(\{[\s\S]*?\});", text)
    assert match, f"Browser configuration is missing: {path}"
    return json.loads(match.group(1))


ROOT = Path(__file__).resolve().parents[1]


def require_build(root: Path) -> None:
    """빌드 결과물을 검사하는 스크립트이므로 dist/ 가 먼저 있어야 한다.

    없을 때 파이썬 트레이스백을 띄우면 사람도 에이전트도 엉뚱한 곳을 고치려 든다.
    무엇을 먼저 돌려야 하는지 알려준다.
    """
    missing = [
        target for target in ("member", "admin")
        if not (root / "dist" / target / "release.json").is_file()
    ]
    if not missing:
        return
    raise SystemExit(
        "빌드 결과물이 없습니다: " + ", ".join(f"dist/{name}" for name in missing) + "\n"
        "\n"
        "이 스크립트는 빌드된 결과물을 검사합니다. 빌드를 먼저 돌리세요.\n"
        "\n"
        "  ./scripts/verify.sh        (테스트·문법·빌드·검사를 한 번에)\n"
        "\n"
        "빌드만 따로 돌리려면:\n"
        "\n"
        "  python3 scripts/build_cloudflare_pages.py --target member --output dist/member\n"
        "  python3 scripts/build_cloudflare_pages.py --target admin  --output dist/admin\n"
    )


require_build(ROOT)
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

for worker_path in (
    ROOT / "dist" / "member" / "_worker.js",
    ROOT / "dist" / "admin" / "_worker.js",
):
    worker = worker_path.read_text(encoding="utf-8")
    assert "native-store-managed" not in worker
    assert 'url.pathname === "/release.json"' not in worker
    assert "env.ASSETS.fetch(request)" in worker
    assert 'headers.set("Access-Control-Allow-Origin", "*")' in worker

for config in (
    ROOT / "dist" / "member" / "shared" / "config.local.js",
    ROOT / "dist" / "admin" / "shared" / "config.local.js",
):
    text = config.read_text(encoding="utf-8")
    assert "service_role" not in text
    assert "PORTONE_API_SECRET" not in text
    browser = browser_config(config)
    assert browser["environment"] == "production"
    assert re.fullmatch(r"[0-9a-f]{64}", browser["projectFingerprint"])
    assert browser["singleSheetImportMode"] == "off"
    assert browser["singleSheetImportReverseEnabled"] is False
    payment = payment_config(config)
    assert payment["mode"] == "multi"
    assert payment["allowedMethods"] == ["tosspay", "bank_transfer"]
    assert payment["bankTransfer"] == {"enabled": True}
    assert set(payment["channels"]) == {"tosspay"}
    assert payment["channels"]["tosspay"]

for relative in (
    "shared/tennisnote-single-sheet-import.js",
    "shared/tennisnote-single-sheet-worker.js",
    "shared/vendor/xlsx.full.min.js",
    "shared/vendor/xlsx.LICENSE",
):
    assert (ROOT / "dist" / "admin" / relative).is_file(), f"Missing Excel worker asset: {relative}"

print(f"Public PWA CI passed for {source['version']} / {source['releaseId']}")
