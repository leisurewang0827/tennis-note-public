#!/usr/bin/env bash
#
# 배포 전 검증 전부를 한 번에 돌린다. CI 가 돌리는 것과 같다.
#
#   ./scripts/verify.sh
#
# 실제 키는 필요 없다. 아래 더미값은 형식만 맞으면 되고, 진짜 서버에
# 접속하지 않는다. 이미 환경변수가 설정돼 있으면 그쪽을 그대로 쓴다.

set -euo pipefail

cd "$(dirname "${BASH_SOURCE[0]}")/.."

: "${TENNISNOTE_SUPABASE_URL:=https://example.supabase.co}"
: "${TENNISNOTE_SUPABASE_PUBLISHABLE_KEY:=test-publishable-key-for-ci-only}"
: "${TENNISNOTE_PORTONE_STORE_ID:=test-store-id}"
: "${TENNISNOTE_PORTONE_TOSSPAY_CHANNEL_KEY:=test-tosspay-channel}"
: "${TENNISNOTE_PAYMENT_MODE:=tosspay_only}"
: "${TENNISNOTE_ALLOWED_PAYMENT_METHODS:=tosspay}"
export TENNISNOTE_SUPABASE_URL TENNISNOTE_SUPABASE_PUBLISHABLE_KEY \
  TENNISNOTE_PORTONE_STORE_ID TENNISNOTE_PORTONE_TOSSPAY_CHANNEL_KEY \
  TENNISNOTE_PAYMENT_MODE TENNISNOTE_ALLOWED_PAYMENT_METHODS

APP_SCRIPTS=(
  app/admin/app.js
  app/admin/schedule-v2-admin.js
  app/tennis-note-member-app/app.js
  app/tennis-note-coach-app/app.js
)

step() { printf "\n\033[1m▶ %s\033[0m\n" "$1"; }
fail() { printf "\n\033[31m✖ %s\033[0m\n" "$1" >&2; exit 1; }

command -v node >/dev/null || fail "node 가 필요합니다. Node 22 이상을 설치하세요."
command -v python3 >/dev/null || fail "python3 이 필요합니다."

step "테스트"
node --test "tests/**/*.test.js"

step "문법 검사"
for script in "${APP_SCRIPTS[@]}"; do
  node --check "$script"
  echo "  ok  $script"
done

step "배포본 빌드"
python3 scripts/build_cloudflare_pages.py --target member --output dist/member
python3 scripts/build_cloudflare_pages.py --target admin --output dist/admin

step "배포본 검사"
python3 scripts/check_cloudflare_build.py

printf "\n\033[32m✔ 전부 통과했습니다.\033[0m\n"
printf "  배포본을 띄워보려면: cd dist/member && python3 -m http.server 8000\n"
