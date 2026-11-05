"""Build isolated Cloudflare Pages artifacts for Tennis Note."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = ROOT / "app"
PAYMENT_METHOD_IDS = ("card", "tosspay", "naverpay", "kakaopay", "bank_transfer")


def clean_output(path: Path) -> None:
    resolved = path.resolve()
    if ROOT != resolved and ROOT not in resolved.parents:
        raise ValueError("Output must stay inside the public repository.")
    if resolved.exists():
        shutil.rmtree(resolved)
    resolved.mkdir(parents=True)


def copy_directory(source: Path, target: Path) -> None:
    shutil.copytree(source, target, dirs_exist_ok=True)


def copy_public_pages(output: Path) -> None:
    for name in ("commerce.html", "support.html", "delete-account.html"):
        shutil.copy2(ROOT / name, output / name)
    for name in ("terms.html", "privacy.html"):
        shutil.copy2(APP_ROOT / "tennis-note-legal" / name, output / name)
    copy_directory(APP_ROOT / "tennis-note-legal", output / "tennis-note-legal")


def env(name: str) -> str:
    return os.environ.get(name, "").strip().lstrip("\ufeff")


def deployment_environment() -> str:
    return "development" if env("TENNISNOTE_ENVIRONMENT").lower() == "development" else "production"


def project_fingerprint(supabase_url: str) -> str:
    clean_url = supabase_url.strip().lower().rstrip("/")
    project_ref = clean_url.removeprefix("https://").removesuffix(".supabase.co")
    if not project_ref or "." in project_ref or "/" in project_ref:
        return ""
    return hashlib.sha256(project_ref.encode("utf-8")).hexdigest()


def payments_enabled() -> bool:
    return env("TENNISNOTE_PAYMENTS_ENABLED").lower() != "false"


def payment_operating_settings() -> tuple[str, list[str]]:
    if not payments_enabled():
        return "disabled", []
    mode = "multi" if env("TENNISNOTE_PAYMENT_MODE").lower() == "multi" else "tosspay_only"
    configured = [
        value.strip().lower()
        for value in env("TENNISNOTE_ALLOWED_PAYMENT_METHODS").split(",")
        if value.strip().lower() in PAYMENT_METHOD_IDS
    ]
    allowed = list(dict.fromkeys(configured)) if mode == "multi" and configured else ["tosspay"]
    if env("TENNISNOTE_BANK_TRANSFER_ENABLED").lower() == "true":
        allowed.append("bank_transfer")
    else:
        allowed = [method for method in allowed if method != "bank_transfer"]
    allowed = list(dict.fromkeys(allowed))
    return mode, allowed


def write_browser_config(output: Path) -> None:
    missing = [
        name
        for name in ("TENNISNOTE_SUPABASE_URL", "TENNISNOTE_SUPABASE_PUBLISHABLE_KEY")
        if not env(name)
    ]
    if missing:
        raise ValueError("Missing required deployment settings: " + ", ".join(missing))

    requested_sheet_mode = env("TENNISNOTE_SINGLE_SHEET_IMPORT_MODE").lower()
    single_sheet_import_mode = requested_sheet_mode if requested_sheet_mode in {"preview", "apply"} else "off"
    single_sheet_import_reverse_enabled = (
        single_sheet_import_mode == "apply"
        and env("TENNISNOTE_SINGLE_SHEET_IMPORT_REVERSE_ENABLED").lower() == "true"
    )
    app_config = {
        "environment": deployment_environment(),
        "supabaseUrl": env("TENNISNOTE_SUPABASE_URL"),
        "supabasePublishableKey": env("TENNISNOTE_SUPABASE_PUBLISHABLE_KEY"),
        "projectFingerprint": project_fingerprint(env("TENNISNOTE_SUPABASE_URL")),
        "singleSheetImportMode": single_sheet_import_mode,
        "singleSheetImportReverseEnabled": single_sheet_import_reverse_enabled,
        "authProviderOverrides": {
            "kakao": "custom:kakao",
            "naver": "custom:naver",
        },
    }
    payment_mode, allowed_methods = payment_operating_settings()
    configured_channels = {
        "card": env("TENNISNOTE_PORTONE_CHANNEL_KEY"),
        "tosspay": env("TENNISNOTE_PORTONE_TOSSPAY_CHANNEL_KEY"),
        "naverpay": env("TENNISNOTE_PORTONE_NAVERPAY_CHANNEL_KEY"),
        "kakaopay": env("TENNISNOTE_PORTONE_KAKAOPAY_CHANNEL_KEY"),
    }
    channels = {
        name: value
        for name, value in configured_channels.items()
        if name in allowed_methods and value
    }
    if payments_enabled() and not env("TENNISNOTE_PORTONE_STORE_ID"):
        raise ValueError("Missing required deployment setting: TENNISNOTE_PORTONE_STORE_ID")
    if payments_enabled() and payment_mode == "tosspay_only" and not channels.get("tosspay"):
        raise ValueError("Missing required deployment setting: TENNISNOTE_PORTONE_TOSSPAY_CHANNEL_KEY")
    payment_config = {
        "enabled": payments_enabled(),
        "provider": "portone",
        "mode": payment_mode,
        "allowedMethods": allowed_methods,
        "bankTransfer": {
            "enabled": env("TENNISNOTE_BANK_TRANSFER_ENABLED").lower() == "true",
        },
        "storeId": env("TENNISNOTE_PORTONE_STORE_ID"),
        "channelKey": channels.get("card", ""),
        "naverPayCategoryType": env("TENNISNOTE_PORTONE_NAVERPAY_CATEGORY_TYPE") if "naverpay" in allowed_methods else "",
        "naverPayCategoryId": env("TENNISNOTE_PORTONE_NAVERPAY_CATEGORY_ID") if "naverpay" in allowed_methods else "",
        "channels": channels,
    }
    target = output / "shared" / "config.local.js"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(
        "window.TENNISNOTE_CONFIG = "
        + json.dumps(app_config, ensure_ascii=False, indent=2)
        + ";\n\nwindow.TENNIS_NOTE_PAYMENT_CONFIG = "
        + json.dumps(payment_config, ensure_ascii=False, indent=2)
        + ";\n",
        encoding="utf-8",
    )


def mark_development_build(output: Path) -> None:
    if deployment_environment() != "development":
        return
    banner = """<aside role=\"status\" aria-label=\"개발계 안내\" style=\"position:sticky;top:0;z-index:2147483647;padding:8px 12px;background:#7c2d12;color:#fff;text-align:center;font:700 13px/1.4 system-ui,sans-serif\">개발계 · 실제 결제·푸시 차단</aside>"""
    for page in output.rglob("*.html"):
        text = page.read_text(encoding="utf-8")
        if 'name="robots"' not in text:
            text = text.replace("</head>", '  <meta name="robots" content="noindex,nofollow" />\n</head>', 1)
        if "개발계 · 실제 결제·푸시 차단" not in text:
            text = text.replace("<body>", f"<body>\n    {banner}", 1)
        page.write_text(text, encoding="utf-8")


def write_platform_files(output: Path, target: str) -> None:
    # Cache-Control 주의:
    #   no-store = 저장 자체를 금지 -> 매 접속마다 전체 재다운로드(관리자 2.3MB, 회원 1.1MB).
    #   no-cache = 저장은 하되 매번 서버에 확인 -> 안 바뀌었으면 304(본문 없음).
    # 아래 기본값은 no-cache 라서 화면에 옛 코드가 남을 위험은 그대로 0이고,
    # 재다운로드 용량만 사라진다. 접속 설정/릴리스 파일은 no-store 를 유지한다.
    headers = """/*
  X-Content-Type-Options: nosniff
  X-Frame-Options: SAMEORIGIN
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(), geolocation=()
  Content-Security-Policy: base-uri 'self'; object-src 'none'; frame-ancestors 'self'
  Cache-Control: no-cache
  Access-Control-Allow-Origin: *

/assets/*
  Cache-Control: public, max-age=86400

/shared/config.local.js
  Cache-Control: no-cache, no-store, must-revalidate

/shared/tennisnote-release.js
  Cache-Control: no-cache, no-store, must-revalidate

/shared/tennisnote-release-updater.js
  Cache-Control: no-cache, no-store, must-revalidate

/release.json
  Cache-Control: no-cache, no-store, must-revalidate
"""
    if target == "member":
        headers += """

/service-worker.js
  Cache-Control: no-cache, no-store, must-revalidate
"""
        redirects = """/tennis-note-member-app / 302
/tennis-note-member-app/ / 302
/tennis-note-member-app/index.html / 302
"""
        (output / "_redirects").write_text(redirects, encoding="utf-8")
    else:
        # 관리자 사이트에도 법적 페이지가 같이 올라가는데, 그 페이지의
        # "앱으로 돌아가기" 버튼은 회원앱 경로를 가리킨다. 관리자 아티팩트에는
        # 회원앱이 없어서 404 였다. 회원 사이트로 넘긴다.
        redirects = """/tennis-note-member-app/* https://tennisnote-app.pages.dev/ 302
"""
        (output / "_redirects").write_text(redirects, encoding="utf-8")
    (output / "_headers").write_text(headers, encoding="utf-8")
    worker = """export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
          "Access-Control-Allow-Headers": "Accept, Cache-Control",
          "Access-Control-Max-Age": "86400",
        },
      });
    }
    const response = await env.ASSETS.fetch(request);
    const headers = new Headers(response.headers);
    headers.set("Access-Control-Allow-Origin", "*");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  },
};
"""
    (output / "_worker.js").write_text(worker, encoding="utf-8")


def build_member(output: Path) -> None:
    copy_directory(APP_ROOT / "tennis-note-member-app", output)
    copy_directory(APP_ROOT / "shared", output / "shared")
    shutil.copy2(APP_ROOT / "release.json", output / "release.json")
    copy_directory(APP_ROOT / "tennis-note-coach-app", output / "tennis-note-coach-app")
    copy_directory(
        APP_ROOT / "tennis-note-member-app" / "assets",
        output / "tennis-note-member-app" / "assets",
    )
    copy_public_pages(output)


def sync_admin_release_labels(output: Path) -> None:
    manifest = json.loads((output / "release.json").read_text(encoding="utf-8"))
    script = output / "shared" / "tennisnote-release.js"
    contents = script.read_text(encoding="utf-8")
    for key in ("version", "releaseId", "appSurfaceVersion", "deployedAt"):
        value = manifest.get(key)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"Missing administrator release field: {key}")
        pattern = rf'^    {key}: "[^"\n]*",$'
        contents, count = re.subn(pattern, lambda _: f"    {key}: {json.dumps(value)},", contents, flags=re.M)
        if count != 1:
            raise ValueError(f"Administrator release template changed: {key}")
    script.write_text(contents, encoding="utf-8")


def write_dev_admin_install_metadata(output: Path) -> None:
    # 서울 개발 관리자에만 설치 정보를 추가한다. 서비스 워커는 등록하지 않는다.
    if (deployment_environment() != "development"
            or env("TENNISNOTE_SUPABASE_URL") != "https://udjmiezroipctytmztwz.supabase.co"
            or payments_enabled()):
        return
    index = output / "index.html"
    contents = index.read_text(encoding="utf-8")
    if contents.count("</head>") != 1 or 'rel="manifest"' in contents:
        raise ValueError("Admin manifest link contract changed")
    manifest = {
        "id": "/", "start_url": "/", "scope": "/",
        "name": "테니스노트 관리자 개발계", "short_name": "테니스노트 DEV 관리자",
        "lang": "ko", "display": "standalone", "theme_color": "#065d45",
        "background_color": "#f4f7f5",
        "icons": [
            {"src": f"/assets/brand/app-icon-{size}.png", "sizes": f"{size}x{size}",
             "type": "image/png", "purpose": "any"} for size in (192, 512)
        ],
    }
    shutil.copy2(APP_ROOT / "tennis-note-member-app/assets/brand/app-icon-512.png",
                 output / "assets/brand/app-icon-512.png")
    (output / "admin-dev.webmanifest").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    index.write_text(contents.replace("</head>", '  <link rel="manifest" href="/admin-dev.webmanifest" />\n</head>'),
                     encoding="utf-8")


def build_admin(output: Path) -> None:
    copy_directory(APP_ROOT / "admin", output)
    copy_directory(APP_ROOT / "shared", output / "shared")
    shutil.copy2(APP_ROOT / "release.json", output / "release.json")
    sync_admin_release_labels(output)
    brand = APP_ROOT / "tennis-note-member-app" / "assets" / "brand"
    local_brand = output / "assets" / "brand"
    local_brand.mkdir(parents=True, exist_ok=True)
    for size in (180, 192):
        shutil.copy2(brand / f"app-icon-{size}.png", local_brand / f"app-icon-{size}.png")
    for filename, expected in (("index.html", 3), ("styles.css", 1)):
        path = output / filename
        contents = path.read_text(encoding="utf-8")
        old = "../tennis-note-member-app/assets/brand/app-icon-"
        if contents.count(old) != expected:
            raise ValueError("Admin brand source contract changed")
        path.write_text(contents.replace(old, "./assets/brand/app-icon-"), encoding="utf-8")
    copy_directory(
        APP_ROOT / "tennis-note-member-app" / "assets",
        output / "tennis-note-member-app" / "assets",
    )
    copy_public_pages(output)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", choices=("member", "admin"), required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    output = (ROOT / args.output).resolve()
    clean_output(output)
    if args.target == "member":
        build_member(output)
    else:
        build_admin(output)
    write_browser_config(output)
    mark_development_build(output)
    write_platform_files(output, args.target)
    if args.target == "admin":
        write_dev_admin_install_metadata(output)
        if (output / "admin-dev.webmanifest").is_file():
            with (output / "_headers").open("a", encoding="utf-8") as headers:
                headers.write("\n/admin-dev.webmanifest\n  Content-Type: application/manifest+json; charset=utf-8\n"
                              "  Cache-Control: no-cache, no-store, must-revalidate\n")
    print(f"Built {args.target} Cloudflare Pages artifact: {output.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
