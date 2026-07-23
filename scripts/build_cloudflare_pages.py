"""Build isolated Cloudflare Pages artifacts for Tennis Note."""

from __future__ import annotations

import argparse
import json
import os
import shutil
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
APP_ROOT = ROOT / "app"


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
    for name in ("commerce.html", "privacy.html", "support.html", "delete-account.html"):
        shutil.copy2(ROOT / name, output / name)
    copy_directory(APP_ROOT / "tennis-note-legal", output / "tennis-note-legal")


def env(name: str) -> str:
    return os.environ.get(name, "").strip().lstrip("\ufeff")


def write_browser_config(output: Path) -> None:
    missing = [
        name
        for name in ("TENNISNOTE_SUPABASE_URL", "TENNISNOTE_SUPABASE_PUBLISHABLE_KEY")
        if not env(name)
    ]
    if missing:
        raise ValueError("Missing required deployment settings: " + ", ".join(missing))

    app_config = {
        "supabaseUrl": env("TENNISNOTE_SUPABASE_URL"),
        "supabasePublishableKey": env("TENNISNOTE_SUPABASE_PUBLISHABLE_KEY"),
        "authProviderOverrides": {
            "kakao": "custom:kakao",
            "naver": "custom:naver",
        },
    }
    payment_config = {
        "provider": "portone",
        "storeId": env("TENNISNOTE_PORTONE_STORE_ID"),
        "channelKey": env("TENNISNOTE_PORTONE_CHANNEL_KEY"),
        "naverPayCategoryType": env("TENNISNOTE_PORTONE_NAVERPAY_CATEGORY_TYPE"),
        "naverPayCategoryId": env("TENNISNOTE_PORTONE_NAVERPAY_CATEGORY_ID"),
        "channels": {
            "card": env("TENNISNOTE_PORTONE_CHANNEL_KEY"),
            "naverpay": env("TENNISNOTE_PORTONE_NAVERPAY_CHANNEL_KEY"),
            "kakaopay": env("TENNISNOTE_PORTONE_KAKAOPAY_CHANNEL_KEY"),
        },
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


def write_platform_files(output: Path, target: str) -> None:
    headers = """/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(self), microphone=(), geolocation=()

/index.html
  Cache-Control: no-cache, no-store, must-revalidate

/shared/config.local.js
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
    (output / "_headers").write_text(headers, encoding="utf-8")


def build_member(output: Path) -> None:
    copy_directory(APP_ROOT / "tennis-note-member-app", output)
    copy_directory(APP_ROOT / "shared", output / "shared")
    copy_directory(APP_ROOT / "tennis-note-coach-app", output / "tennis-note-coach-app")
    copy_directory(
        APP_ROOT / "tennis-note-member-app" / "assets",
        output / "tennis-note-member-app" / "assets",
    )
    copy_public_pages(output)


def build_admin(output: Path) -> None:
    copy_directory(APP_ROOT / "admin", output)
    copy_directory(APP_ROOT / "shared", output / "shared")
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
    write_platform_files(output, args.target)
    print(f"Built {args.target} Cloudflare Pages artifact: {output.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
